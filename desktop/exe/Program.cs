using System;
using System.Diagnostics;
using System.Drawing;
using System.IO;
using System.Net;
using System.Net.Sockets;
using System.Text;
using System.Threading;
using System.Threading.Tasks;
using System.Windows.Forms;
using Microsoft.Web.WebView2.Core;
using Microsoft.Web.WebView2.WinForms;

namespace Axiom
{
    internal static class Program
    {
        [STAThread]
        private static void Main(string[] args)
        {
            if (args != null && Array.IndexOf(args, "--selftest") >= 0)
            {
                Environment.Exit(SelfTest.Run());
                return;
            }

            bool created;
            using (Mutex mutex = new Mutex(true, "AxiomMathClient", out created))
            {
                if (!created)
                {
                    MessageBox.Show("公理数学客户端已经在运行。", "公理", MessageBoxButtons.OK, MessageBoxIcon.Information);
                    return;
                }
                Application.EnableVisualStyles();
                Application.SetCompatibleTextRenderingDefault(false);
                try
                {
                    Application.Run(new MainForm());
                }
                catch (Exception failure)
                {
                    WriteCrash(failure);
                    MessageBox.Show("客户端启动失败：\n" + failure.Message + "\n\n错误日志：" +
                        Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "startup-error.log"),
                        "公理数学客户端", MessageBoxButtons.OK, MessageBoxIcon.Error);
                }
                GC.KeepAlive(mutex);
            }
        }

        internal static void WriteCrash(Exception failure)
        {
            try
            {
                File.AppendAllText(Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "startup-error.log"),
                    DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss") + " " + failure + "\r\n");
            }
            catch { }
        }
    }

    internal static class SelfTest
    {
        public static int Run()
        {
            string root = AppDomain.CurrentDomain.BaseDirectory;
            string data = Path.Combine(root, "selftest");
            Process server = null;
            StreamWriter log = null;
            try
            {
                if (Directory.Exists(data)) Directory.Delete(data, true);
                Directory.CreateDirectory(Path.Combine(data, "data"));
                Directory.CreateDirectory(Path.Combine(data, "logs"));
                Directory.CreateDirectory(Path.Combine(data, "temp"));
                log = new StreamWriter(Path.Combine(data, "logs", "server.log"), false, Encoding.UTF8);
                log.AutoFlush = true;

                int port = FreePort();
                string url = "http://127.0.0.1:" + port + "/";
                ProcessStartInfo info = new ProcessStartInfo();
                info.FileName = Path.Combine(root, "runtime", "bin", "java.exe");
                info.Arguments = "-Djava.io.tmpdir=\"" + Path.Combine(data, "temp") +
                    "\" -jar \"" + Path.Combine(root, "app", "math-server.jar") + "\"";
                info.WorkingDirectory = data;
                info.UseShellExecute = false;
                info.CreateNoWindow = true;
                info.RedirectStandardOutput = true;
                info.RedirectStandardError = true;
                info.EnvironmentVariables["MATH_DESKTOP"] = "1";
                info.EnvironmentVariables["MATH_PORT"] = port.ToString();
                info.EnvironmentVariables["MATH_DB_PATH"] = Path.Combine(data, "data", "math.db");
                info.EnvironmentVariables["MATH_WEB_DIR"] = Path.Combine(root, "frontend");

                server = new Process();
                server.StartInfo = info;
                server.OutputDataReceived += delegate(object sender, DataReceivedEventArgs line)
                {
                    if (line.Data != null) { try { log.WriteLine(line.Data); } catch { } }
                };
                server.ErrorDataReceived += delegate(object sender, DataReceivedEventArgs line)
                {
                    if (line.Data != null) { try { log.WriteLine(line.Data); } catch { } }
                };
                server.Start();
                server.BeginOutputReadLine();
                server.BeginErrorReadLine();

                string me = null;
                for (int attempt = 0; attempt < 120; attempt++)
                {
                    if (server.HasExited) throw new Exception("local server exited");
                    try
                    {
                        using (WebClient client = new WebClient())
                        {
                            client.Encoding = Encoding.UTF8;
                            string health = client.DownloadString(url + "api/health");
                            if (health.IndexOf("\"status\":\"ok\"", StringComparison.Ordinal) >= 0)
                            {
                                me = client.DownloadString(url + "api/auth/me");
                                break;
                            }
                        }
                    }
                    catch { }
                    Thread.Sleep(500);
                }
                if (me == null) throw new Exception("health check timed out");
                if (me.IndexOf("\"username\":\"local\"", StringComparison.Ordinal) < 0)
                    throw new Exception("desktop identity missing: " + me);

                File.WriteAllText(Path.Combine(root, "selftest-result.txt"),
                    "OK " + url + "\r\n" + me + "\r\n", Encoding.UTF8);
                return 0;
            }
            catch (Exception failure)
            {
                try
                {
                    File.WriteAllText(Path.Combine(root, "selftest-result.txt"),
                        "FAIL " + failure + "\r\n", Encoding.UTF8);
                }
                catch { }
                Program.WriteCrash(failure);
                return 1;
            }
            finally
            {
                try { if (server != null && !server.HasExited) server.Kill(); } catch { }
                try { if (log != null) log.Close(); } catch { }
            }
        }

        private static int FreePort()
        {
            TcpListener listener = new TcpListener(IPAddress.Loopback, 0);
            listener.Start();
            int value = ((IPEndPoint)listener.LocalEndpoint).Port;
            listener.Stop();
            return value;
        }
    }

    internal sealed class MainForm : Form
    {
        private readonly WebView2 browser = new WebView2();
        private readonly Panel webPanel = new Panel();
        private readonly Panel webToolbar = new Panel();
        private readonly WebView2 webBrowser = new WebView2();
        private readonly Label status = new Label();
        private Process server;
        private StreamWriter log;
        private string appRoot;
        private string dataRoot;
        private string logPath;
        private string baseUrl;
        private int port;
        private bool closing;
        private CoreWebView2Environment webViewEnvironment;
        private WebViewForm webWindow;
        private bool webPanelReady;

        public MainForm()
        {
            Text = "公理数学客户端";
            Rectangle working = Screen.PrimaryScreen.WorkingArea;
            Width = Math.Min(1440, working.Width - 40);
            Height = Math.Min(900, working.Height - 40);
            MinimumSize = new Size(960, 640);
            StartPosition = FormStartPosition.CenterScreen;
            string iconPath = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "app.ico");
            if (File.Exists(iconPath))
            {
                try { Icon = new Icon(iconPath); } catch { }
            }

            browser.Dock = DockStyle.Fill;
            browser.Visible = false;
            status.Dock = DockStyle.Fill;
            status.TextAlign = ContentAlignment.MiddleCenter;
            status.Text = "正在启动本地服务…";
            status.Font = new Font("Microsoft YaHei UI", 14F, FontStyle.Regular);
            Controls.Add(browser);
            Controls.Add(status);

            webPanel.Visible = false;
            webPanel.BorderStyle = BorderStyle.FixedSingle;
            webPanel.BackColor = Color.White;
            webToolbar.Dock = DockStyle.Top;
            webToolbar.Height = 36;
            webToolbar.BackColor = Color.FromArgb(246, 248, 252);
            Label webTitle = new Label();
            webTitle.Text = "DeepSeek 网页版";
            webTitle.Dock = DockStyle.Left;
            webTitle.Width = 200;
            webTitle.TextAlign = ContentAlignment.MiddleLeft;
            webTitle.Padding = new Padding(10, 0, 0, 0);
            Button webBack = new Button();
            webBack.Text = "返回";
            webBack.Dock = DockStyle.Right;
            webBack.Width = 72;
            webBack.FlatStyle = FlatStyle.System;
            webBack.Click += (sender, args) => HideEmbeddedWeb();
            Button webClose = new Button();
            webClose.Text = "关闭网页";
            webClose.Dock = DockStyle.Right;
            webClose.Width = 86;
            webClose.FlatStyle = FlatStyle.System;
            webClose.Click += (sender, args) => HideEmbeddedWeb();
            webToolbar.Controls.Add(webTitle);
            webToolbar.Controls.Add(webBack);
            webToolbar.Controls.Add(webClose);
            webBrowser.Dock = DockStyle.Fill;
            webPanel.Controls.Add(webBrowser);
            webPanel.Controls.Add(webToolbar);
            Controls.Add(webPanel);

            Shown += OnShown;
            FormClosing += OnClosing;
        }

        private async void OnShown(object sender, EventArgs e)
        {
            try
            {
                appRoot = AppDomain.CurrentDomain.BaseDirectory;
                string overrideDir = Environment.GetEnvironmentVariable("AXIOM_DATA_DIR");
                bool portable = File.Exists(Path.Combine(appRoot, "data", "math.db"));
                dataRoot = !String.IsNullOrEmpty(overrideDir)
                    ? overrideDir
                    : portable
                        ? appRoot
                        : Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.MyDocuments), "Axiom");
                Directory.CreateDirectory(Path.Combine(dataRoot, "data"));
                Directory.CreateDirectory(Path.Combine(dataRoot, "logs"));
                Directory.CreateDirectory(Path.Combine(dataRoot, "temp"));
                Directory.CreateDirectory(Path.Combine(dataRoot, "webview2"));
                logPath = Path.Combine(dataRoot, "logs", "client.log");
                log = new StreamWriter(logPath, true, Encoding.UTF8);
                log.AutoFlush = true;

                port = FreePort();
                baseUrl = "http://127.0.0.1:" + port + "/";
                WriteLog("starting " + baseUrl);
                StartServer();
                await Task.Run(new Action(WaitForHealth));

                string version = CoreWebView2Environment.GetAvailableBrowserVersionString();
                if (String.IsNullOrEmpty(version))
                {
                    throw new Exception("未检测到 Microsoft Edge WebView2 运行时。请安装 WebView2 Runtime 后重试。");
                }
                webViewEnvironment = await CoreWebView2Environment.CreateAsync(
                    null, Path.Combine(dataRoot, "webview2"), null);
                await browser.EnsureCoreWebView2Async(webViewEnvironment);
                browser.ZoomFactor = 1.0;

                browser.CoreWebView2.Settings.AreDevToolsEnabled = false;
                browser.CoreWebView2.Settings.AreDefaultContextMenusEnabled = false;
                browser.CoreWebView2.Settings.IsStatusBarEnabled = false;
                browser.CoreWebView2.NewWindowRequested += OnNewWindow;
                browser.CoreWebView2.WebMessageReceived += OnWebMessage;
                browser.CoreWebView2.NavigationStarting += OnNavigationStarting;
                browser.CoreWebView2.ProcessFailed += OnProcessFailed;
                browser.CoreWebView2.Navigate(baseUrl);

                status.Visible = false;
                browser.Visible = true;
                browser.Focus();
            }
            catch (Exception failure)
            {
                Fail(failure);
            }
        }

        private void StartServer()
        {
            string java = Path.Combine(appRoot, "runtime", "bin", "java.exe");
            string jar = Path.Combine(appRoot, "app", "math-server.jar");
            if (!File.Exists(java)) throw new Exception("客户端缺少 runtime\\bin\\java.exe，请重新解压完整包。");
            if (!File.Exists(jar)) throw new Exception("客户端缺少 app\\math-server.jar，请重新解压完整包。");

            ProcessStartInfo info = new ProcessStartInfo();
            info.FileName = java;
            info.Arguments = "-Djava.io.tmpdir=\"" + Path.Combine(dataRoot, "temp") +
                "\" -jar \"" + jar + "\"";
            info.WorkingDirectory = dataRoot;
            info.UseShellExecute = false;
            info.CreateNoWindow = true;
            info.RedirectStandardOutput = true;
            info.RedirectStandardError = true;
            info.EnvironmentVariables["MATH_DESKTOP"] = "1";
            info.EnvironmentVariables["MATH_PORT"] = port.ToString();
            info.EnvironmentVariables["MATH_DB_PATH"] = Path.Combine(dataRoot, "data", "math.db");
            info.EnvironmentVariables["MATH_WEB_DIR"] = Path.Combine(appRoot, "frontend");
            string externalRootFile = Path.Combine(dataRoot, "data", "external-root.txt");
            if (File.Exists(externalRootFile)) {
                string root = File.ReadAllText(externalRootFile).Trim();
                if (root.Length > 0) info.EnvironmentVariables["MATH_EXTERNAL_ROOT"] = root;
            }
            server = new Process();
            server.StartInfo = info;
            server.EnableRaisingEvents = true;
            server.OutputDataReceived += delegate(object sender, DataReceivedEventArgs line)
            {
                if (line.Data != null) WriteLog(line.Data);
            };
            server.ErrorDataReceived += delegate(object sender, DataReceivedEventArgs line)
            {
                if (line.Data != null) WriteLog(line.Data);
            };
            server.Exited += delegate
            {
                if (closing) return;
                try
                {
                    BeginInvoke(new Action(delegate
                    {
                        Fail(new Exception("本地服务已退出。请查看日志：" + logPath));
                    }));
                }
                catch { }
            };
            server.Start();
            server.BeginOutputReadLine();
            server.BeginErrorReadLine();
        }

        private void WaitForHealth()
        {
            for (int attempt = 0; attempt < 120; attempt++)
            {
                if (server.HasExited)
                {
                    throw new Exception("本地服务启动失败。请查看日志：" + logPath);
                }
                try
                {
                    using (WebClient client = new WebClient())
                    {
                        client.Encoding = Encoding.UTF8;
                        string body = client.DownloadString(baseUrl + "api/health");
                        if (body.IndexOf("\"status\":\"ok\"", StringComparison.Ordinal) >= 0) return;
                    }
                }
                catch { }
                Thread.Sleep(500);
            }
            throw new Exception("本地服务启动超时。请查看日志：" + logPath);
        }

        private void OnNewWindow(object sender, CoreWebView2NewWindowRequestedEventArgs args)
        {
            args.Handled = true;
            OpenExternal(args.Uri);
        }

        private void OnWebMessage(object sender, CoreWebView2WebMessageReceivedEventArgs args)
        {
            string message = args.TryGetWebMessageAsString();
            if (String.IsNullOrEmpty(message)) return;
            string[] parts = message.Split(new char[] { '|' }, 6);
            if (parts.Length == 6 && parts[0] == "open-web")
            {
                int x, y, width, height;
                if (Int32.TryParse(parts[1], out x) && Int32.TryParse(parts[2], out y)
                    && Int32.TryParse(parts[3], out width) && Int32.TryParse(parts[4], out height)
                    && width > 100 && height > 100)
                {
                    webPanel.Bounds = ClampWebBounds(x, y, width, height);
                    ShowEmbeddedWeb(parts[5]);
                }
            }
            else if (parts.Length == 5 && parts[0] == "web-bounds" && webPanel.Visible)
            {
                int x, y, width, height;
                if (Int32.TryParse(parts[1], out x) && Int32.TryParse(parts[2], out y)
                    && Int32.TryParse(parts[3], out width) && Int32.TryParse(parts[4], out height)
                    && width > 100 && height > 100)
                    webPanel.Bounds = ClampWebBounds(x, y, width, height);
            }
            else if (message == "web-close")
                HideEmbeddedWeb();
        }

        private Rectangle ClampWebBounds(int x, int y, int width, int height)
        {
            x = Math.Max(0, Math.Min(x, Math.Max(0, ClientSize.Width - 120)));
            y = Math.Max(0, Math.Min(y, Math.Max(0, ClientSize.Height - 120)));
            width = Math.Min(width, Math.Max(120, ClientSize.Width - x));
            height = Math.Min(height, Math.Max(120, ClientSize.Height - y));
            return new Rectangle(x, y, width, height);
        }

        private async void ShowEmbeddedWeb(string uri)
        {
            if (webViewEnvironment == null) return;
            webPanel.Visible = true;
            webPanel.BringToFront();
            bool first = !webPanelReady;
            if (first)
            {
                try
                {
                    await webBrowser.EnsureCoreWebView2Async(webViewEnvironment);
                    if (closing) return;
                    webPanelReady = true;
                    webBrowser.CoreWebView2.Settings.AreDevToolsEnabled = false;
                    webBrowser.CoreWebView2.Settings.AreDefaultContextMenusEnabled = true;
                    webBrowser.CoreWebView2.Settings.IsStatusBarEnabled = false;
                    webBrowser.CoreWebView2.NewWindowRequested += (sender, args) =>
                    {
                        if (DeepSeekUrl(args.Uri))
                        {
                            args.Handled = true;
                            webBrowser.CoreWebView2.Navigate(args.Uri);
                        }
                    };
                    webBrowser.CoreWebView2.Navigate(uri);
                }
                catch (Exception failure)
                {
                    webPanel.Visible = false;
                    Fail(failure);
                    return;
                }
            }
            webBrowser.Focus();
        }

        private void HideEmbeddedWeb()
        {
            webPanel.Visible = false;
            try
            {
                if (browser.CoreWebView2 != null) browser.CoreWebView2.PostWebMessageAsString("web-closed");
            }
            catch { }
            browser.Focus();
        }

        internal static bool DeepSeekUrl(string value)
        {
            Uri uri;
            return Uri.TryCreate(value, UriKind.Absolute, out uri)
                && uri.Scheme == Uri.UriSchemeHttps
                && (uri.Host.Equals("deepseek.com", StringComparison.OrdinalIgnoreCase)
                    || uri.Host.EndsWith(".deepseek.com", StringComparison.OrdinalIgnoreCase));
        }

        private void ShowWebWindow(string uri)
        {
            if (webWindow == null || webWindow.IsDisposed)
            {
                webWindow = new WebViewForm(webViewEnvironment, uri);
                webWindow.FormClosed += (sender, args) => { webWindow = null; };
                webWindow.Show(this);
            }
            else
            {
                webWindow.Navigate(uri);
                if (webWindow.WindowState == FormWindowState.Minimized) webWindow.WindowState = FormWindowState.Normal;
                webWindow.Activate();
            }
        }

        private void OnNavigationStarting(object sender, CoreWebView2NavigationStartingEventArgs args)
        {
            if (args.Uri.StartsWith("http://127.0.0.1:", StringComparison.OrdinalIgnoreCase)) return;
            args.Cancel = true;
            OpenExternal(args.Uri);
        }

        private void OnProcessFailed(object sender, CoreWebView2ProcessFailedEventArgs args)
        {
            if (closing) return;
            try
            {
                BeginInvoke(new Action(delegate
                {
                    Fail(new Exception("页面进程异常：" + args.ProcessFailedKind));
                }));
            }
            catch { }
        }

        private void OpenExternal(string uri)
        {
            try
            {
                ProcessStartInfo info = new ProcessStartInfo(uri);
                info.UseShellExecute = true;
                Process.Start(info);
            }
            catch { }
        }

        private void WriteLog(string line)
        {
            try
            {
                lock (this)
                {
                    if (log != null) log.WriteLine(DateTime.Now.ToString("HH:mm:ss") + " " + line);
                }
            }
            catch { }
        }

        private void Fail(Exception failure)
        {
            WriteLog("FATAL " + failure);
            Program.WriteCrash(failure);
            try
            {
                MessageBox.Show(this, failure.Message + "\n\n日志：" + logPath,
                    "公理数学客户端", MessageBoxButtons.OK, MessageBoxIcon.Error);
            }
            catch { }
            Close();
        }

        private void OnClosing(object sender, FormClosingEventArgs e)
        {
            closing = true;
            try
            {
                if (server != null && !server.HasExited) server.Kill();
            }
            catch { }
            try
            {
                if (log != null) log.Close();
            }
            catch { }
        }

        private static int FreePort()
        {
            TcpListener listener = new TcpListener(IPAddress.Loopback, 0);
            listener.Start();
            int value = ((IPEndPoint)listener.LocalEndpoint).Port;
            listener.Stop();
            return value;
        }
    }

    internal sealed class WebViewForm : Form
    {
        private readonly WebView2 browser = new WebView2();
        private readonly CoreWebView2Environment environment;
        private string pendingUri;
        private bool closed;

        public WebViewForm(CoreWebView2Environment environment, string uri)
        {
            this.environment = environment;
            pendingUri = uri;
            Text = "DeepSeek 网页版 · 手动复制";
            Width = 1100;
            Height = 820;
            MinimumSize = new Size(720, 520);
            StartPosition = FormStartPosition.CenterParent;
            browser.Dock = DockStyle.Fill;
            browser.Visible = false;
            Controls.Add(browser);
            Shown += OnShown;
            FormClosed += (sender, args) => { closed = true; };
        }

        public void Navigate(string uri)
        {
            pendingUri = uri;
            if (browser.CoreWebView2 != null) browser.CoreWebView2.Navigate(uri);
        }

        private async void OnShown(object sender, EventArgs e)
        {
            try
            {
                await browser.EnsureCoreWebView2Async(environment);
                if (closed) return;
                browser.CoreWebView2.Settings.AreDevToolsEnabled = false;
                browser.CoreWebView2.Settings.AreDefaultContextMenusEnabled = true;
                browser.CoreWebView2.Settings.IsStatusBarEnabled = false;
                browser.CoreWebView2.NewWindowRequested += (source, args) =>
                {
                    if (MainForm.DeepSeekUrl(args.Uri))
                    {
                        args.Handled = true;
                        browser.CoreWebView2.Navigate(args.Uri);
                    }
                };
                browser.CoreWebView2.Navigate(pendingUri);
                browser.Visible = true;
                browser.Focus();
            }
            catch (Exception failure)
            {
                MessageBox.Show("DeepSeek 网页版打开失败：" + failure.Message, "公理", MessageBoxButtons.OK, MessageBoxIcon.Warning);
                Close();
            }
        }
    }
}
