#!/usr/bin/env bash
# 安全发布脚本：构建成功才重启；健康检查失败自动回滚到上一版 JAR。
#
# 用法（服务器 root）：
#   sudo /opt/math-platform/backend/deploy/release.sh
#
# 环境变量可覆盖：APP_DIR、SERVICE、SERVICE_USER、HEALTH_URL、SNAP_DIR、KEEP。
# 数据库备份保留在 $APP_DIR/backend/data/backups，由 backup_database.py 轮换。
# 注意：启动时的数据库迁移是前向的，回滚 JAR 不会撤销表结构变更；必要时用备份恢复数据库。
set -euo pipefail

APP_DIR="${APP_DIR:-/opt/math-platform}"
SERVICE="${SERVICE:-math-platform}"
SERVICE_USER="${SERVICE_USER:-math-platform}"
HEALTH_URL="${HEALTH_URL:-http://127.0.0.1:8080/api/health}"
SNAP_DIR="${SNAP_DIR:-$APP_DIR/backend/data/releases}"
KEEP="${KEEP:-5}"

if [ "$(id -u)" -ne 0 ]; then
  echo "请用 root 运行：sudo $0" >&2
  exit 1
fi
for command in git curl systemctl runuser install python3; do
  command -v "$command" >/dev/null 2>&1 || { echo "缺少命令：$command" >&2; exit 1; }
done

cd "$APP_DIR"
echo "==> 更新代码"
git pull --ff-only

cd "$APP_DIR/backend"
echo "==> 构建（失败则不会重启服务）"
./mvnw -B package

echo "==> 备份数据库与 AI 密钥"
runuser -u "$SERVICE_USER" -- python3 admin/backup_database.py \
  --database data/math.db --output-dir data/backups --keep 14

stamp="$(date +%Y%m%d-%H%M%S)"
install -d -o "$SERVICE_USER" -g "$SERVICE_USER" -m 700 "$SNAP_DIR"
install -m 600 -o "$SERVICE_USER" -g "$SERVICE_USER" \
  target/math-server.jar "$SNAP_DIR/math-server-$stamp.jar"
echo "==> 已保存当前版本：$SNAP_DIR/math-server-$stamp.jar"

echo "==> 重启服务"
systemctl restart "$SERVICE"

healthy=0
for _ in $(seq 1 60); do
  if curl -fsS --max-time 3 "$HEALTH_URL" >/dev/null 2>&1; then
    healthy=1
    break
  fi
  sleep 2
done

if [ "$healthy" -ne 1 ]; then
  echo "健康检查失败，尝试回滚到上一版 JAR" >&2
  previous="$(find "$SNAP_DIR" -maxdepth 1 -name 'math-server-*.jar' \
    ! -name "math-server-$stamp.jar" -printf '%T@ %p\n' | sort -rn | head -n 1 | cut -d' ' -f2-)"
  if [ -n "$previous" ]; then
    install -m 600 -o "$SERVICE_USER" -g "$SERVICE_USER" "$previous" target/math-server.jar
    systemctl restart "$SERVICE"
    sleep 3
    if curl -fsS --max-time 3 "$HEALTH_URL" >/dev/null 2>&1; then
      echo "已回滚：$previous" >&2
    else
      echo "回滚后仍不健康，请查看：journalctl -u $SERVICE -n 100 --no-pager -l" >&2
    fi
  else
    echo "没有可回滚的旧 JAR，请查看：journalctl -u $SERVICE -n 100 --no-pager -l" >&2
  fi
  echo "数据库迁移不会随 JAR 回滚；必要时从 data/backups 恢复数据库。" >&2
  exit 1
fi

echo "==> 清理旧版本（保留最近 $KEEP 个）"
find "$SNAP_DIR" -maxdepth 1 -name 'math-server-*.jar' -printf '%T@ %p\n' \
  | sort -rn | tail -n "+$((KEEP + 1))" | cut -d' ' -f2- | xargs -r rm -f

echo "发布完成：$HEALTH_URL"
