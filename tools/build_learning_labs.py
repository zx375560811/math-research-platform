"""Build original, self-contained teaching notebooks. This never calls a model API."""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'frontend/labs'


def notebook(slug, title, requirements, setup, follow, fill, validate, challenge, independent, validate_independent, answer, notes=''):
    cells = []

    def add(kind, source, tags=()):
        value = {'cell_type': kind, 'id': slug + '-' + str(len(cells)), 'metadata': {'tags': list(tags)}, 'source': source.strip().splitlines(True)}
        if kind == 'code':
            value.update(execution_count=None, outputs=[])
        if 'reference' in tags:
            value['metadata'].update(jupyter={'source_hidden': True}, collapsed=True)
        cells.append(value)

    add('markdown', '# ' + title + '\n\nAxiom 配套实验。请先读懂对应教材，再按三个阶段练习。计算在你自己的电脑运行。\n\n'
        '## 准备环境\n\n建议 Python 3.11 或 3.12，在单独虚拟环境中运行下面的安装命令，然后用 `jupyter notebook` 打开本文件。\n\n'
        '```bash\n' + ('python -m pip install notebook\npython -m pip install torch --index-url https://download.pytorch.org/whl/cpu' if requirements=='torch' else 'python -m pip install notebook '+requirements) + '\n```\n\n'
        '先运行“跟着做”。带 TODO 的函数初始返回 None，检查单元会提示待完成。补全后重新运行函数定义与检查单元。'
        '独立练习应另写实现，再核对结果。参考解答在文件末尾；网页的阶段勾选是个人学习记录，不代表系统已执行你的代码。\n\n' + notes)
    add('code', setup, ('setup',))
    add('markdown', '## 1. 跟着做\n\n逐步运行示例，解释每个输入、运算和输出。再修改一个输入观察变化。')
    add('code', follow, ('follow',))
    add('markdown', '## 2. 自己补全\n\n在下面函数中填写 TODO。可回看示例，但请说明你填写的每一行做了什么。')
    add('code', fill, ('fill',))
    add('code', validate, ('fill-check',))
    add('markdown', '## 3. 独立完成\n\n' + challenge)
    add('code', independent, ('independent',))
    add('code', validate_independent, ('independent-check',))
    add('markdown', '## 提示与复盘\n\n先检查输入形状、数据类型和边界情况。网页“查看提示”提供针对本实验的提示。'
        '记录你遇到的一处错误、修复方法和结果。通过数值检查后，还需要自己解释原理。')
    add('markdown', '## 参考解答\n\n先独立尝试再展开下方代码。示例是可核对的一种实现，不是唯一写法。')
    add('code', answer, ('reference',))
    value = {'nbformat': 4, 'nbformat_minor': 5, 'metadata': {
        'kernelspec': {'display_name': 'Python 3', 'language': 'python', 'name': 'python3'},
        'language_info': {'name': 'python'}, 'axiom': {'lab': slug, 'stages': ['follow', 'fill', 'independent'], 'live_api_default': False}
    }, 'cells': cells}
    OUT.mkdir(parents=True, exist_ok=True)
    (OUT / (slug + '.ipynb')).write_text(json.dumps(value, ensure_ascii=False, indent=1) + '\n', encoding='utf-8')


def build():
    notebook('calculus', '函数、切线与数值导数', 'numpy matplotlib', '''
import numpy as np
import matplotlib.pyplot as plt
def check_derivative(solver):
    for f, x, expected in [(lambda t:t*t, 2.0, 4.0), (np.sin, 0.0, 1.0), (lambda t:t**3-2*t, 1.0, 1.0)]:
        assert abs(solver(f,x,1e-5)-expected)<1e-6
    print('导数数值检查通过；仍需解释差分公式。')
''', '''
def demo_derivative(f,x,h=1e-5):
    return (f(x+h)-f(x-h))/(2*h)
x=np.linspace(-2,2,200)
point=1.0
slope=demo_derivative(lambda t:t*t,point)
plt.plot(x,x*x,label='f(x)=x²')
plt.plot(x,point**2+slope*(x-point),label='tangent at x=1')
plt.legend();plt.grid();plt.show()
print('x² 在 x=1 的斜率：',slope)
''', '''
def student_derivative(f,x,h=1e-5):
    above=f(x+h)
    below=f(x-h)
    # TODO: 使用 above、below 和 h 返回中心差分，不要硬编码答案
    return None
''', '''
if student_derivative(lambda x:x*x,2.0) is None:
    print('待完成：补全 student_derivative，然后重新运行本单元。')
else:
    check_derivative(student_derivative)
''', '独立实现一个相同接口的求导函数，计算 x³−2x 在 x=1 的导数。比较 h=1e-1、1e-3、1e-5、1e-7 的误差，并画出函数和切线。误差不要求随步长一直减小。', '''
def independent_derivative(f,x,h=1e-5):
    # TODO: 脱离示例独立实现
    return None
''', '''
if independent_derivative(lambda x:x**3-2*x,1.0) is None:
    print('待完成：独立实现并画图，再运行检查。')
else:
    check_derivative(independent_derivative)
    print([(h,abs(independent_derivative(lambda x:x**3-2*x,1,h)-1)) for h in [1e-1,1e-3,1e-5,1e-7]])
''', '''
check_derivative(demo_derivative)
print('参考：x³−2x 的解析导数为 3x²−2，在 x=1 为 1。')
''')

    notebook('linear-algebra', '矩阵如何变换平面', 'numpy matplotlib', '''
import numpy as np
import matplotlib.pyplot as plt
P=np.array([[0,1,1,0,0],[0,0,1,1,0]],dtype=float)
A=np.array([[0,-1],[1,0]],dtype=float)
B=np.array([[2,0],[0,1]],dtype=float)
def check_transform(solver):
    assert np.allclose(solver(A,np.array([[1.],[0.]])),[[0.],[1.]])
    assert np.allclose(solver(np.diag([1,0]),P)[1],0)
    assert np.allclose(solver(B,P),B@P)
    print('旋转、拉伸与投影检查通过。')
def check_composition(solver):
    assert np.allclose(solver(A,B,P),B@A@P)
    assert np.allclose(solver(B,A,P),A@B@P)
    print('组合变换检查通过；还要说明先后顺序。')
''', '''
def demo_transform(matrix,points):
    return matrix@points
Q=demo_transform(A,P)
plt.plot(*P,label='original');plt.plot(*Q,label='rotated')
plt.axis('equal');plt.grid();plt.legend();plt.show()
print('点集形状',P.shape,'变换后',Q.shape)
''', '''
def student_transform(matrix,points):
    # TODO: 矩阵作用于列向量，不是逐元素相乘
    return None
''', '''
if student_transform(A,P) is None:print('待完成：补全矩阵变换。')
else:check_transform(student_transform)
''', '独立实现先作用 first、再作用 second 的组合变换，交换两者比较结果。画图说明旋转和非等比拉伸通常不能交换顺序。', '''
def independent_composition(first,second,points):
    # TODO: 返回先 first 后 second 的结果
    return None
''', '''
if independent_composition(A,B,P) is None:print('待完成：独立实现组合变换。')
else:check_composition(independent_composition)
''', '''
check_transform(demo_transform)
def reference_composition(first,second,points):return second@first@points
check_composition(reference_composition)
print('交换后相同吗？',np.allclose(B@A@P,A@B@P))
''')

    notebook('python', '我的学习记录统计', 'matplotlib', '''
import csv,io
import matplotlib.pyplot as plt
CSV_TEXT="date,minutes,course\\n2026-01-01,30,analysis\\n2026-01-01,20,python\\n2026-01-02,40,algebra\\n2026-01-03,25,python\\n2026-01-03,35,analysis\\n"
def read_records(text):return list(csv.DictReader(io.StringIO(text)))
def check_daily(solver):
    assert solver(CSV_TEXT)=={'2026-01-01':50,'2026-01-02':40,'2026-01-03':60}
    assert solver('date,minutes,course\\n2026-02-01,10,python\\n2026-02-01,5,analysis\\n')=={'2026-02-01':15}
    print('按日期统计通过，示例总时长 150 分钟。')
def check_course(solver):
    assert solver(CSV_TEXT)=={'analysis':65,'python':45,'algebra':40}
    assert solver('date,minutes,course\\n2026-02-01,5,geometry\\n')=={'geometry':5}
    print('按课程统计通过。')
''', '''
def demo_totals(text,key='date'):
    totals={}
    for row in read_records(text):
        name=row[key]
        totals[name]=totals.get(name,0)+int(row['minutes'])
    return totals
daily=demo_totals(CSV_TEXT)
print(daily)
plt.bar(list(daily),list(daily.values()));plt.ylabel('minutes');plt.xticks(rotation=20);plt.show()
''', '''
def student_daily(text):
    totals={}
    for row in read_records(text):
        date=row['date']
        minutes=int(row['minutes'])
        # TODO: 把 minutes 累计到 totals[date]，注意新日期的初始值
    # TODO: 完成后返回 totals
    return None
''', '''
if student_daily(CSV_TEXT) is None:print('待完成：按日期汇总。')
else:check_daily(student_daily)
''', '换一个分组维度：按课程累计学习时长，返回字典并画出课程时长图。检查新课程名称出现时程序仍能工作。示例是教学数据，不是你的真实学习记录。', '''
def independent_course(text):
    # TODO: 按课程累计
    return None
''', '''
if independent_course(CSV_TEXT) is None:print('待完成：按课程汇总并画图。')
else:check_course(independent_course)
''', '''
check_daily(demo_totals)
def reference_course(text):return demo_totals(text,'course')
check_course(reference_course)
''')

    notebook('machine-learning', '一步步完成鸢尾花分类', 'numpy matplotlib scikit-learn', '''
import numpy as np
import matplotlib.pyplot as plt
from sklearn.datasets import load_iris
from sklearn.model_selection import train_test_split
from sklearn.neighbors import KNeighborsClassifier
from sklearn.metrics import accuracy_score,confusion_matrix
iris=load_iris()
X_train,X_test,y_train,y_test=train_test_split(iris.data,iris.target,test_size=.25,random_state=0)
print('样本与特征：',iris.data.shape,iris.feature_names)
print('训练/测试数量：',len(X_train),len(X_test))
print('类别与数量：',list(zip(iris.target_names,np.bincount(iris.target))))
print('前五条特征：\\n',iris.data[:5])
def check_report(report,k,Xt,Xv,yt,yv):
    model=report['model'];pred=np.asarray(report['predictions'])
    assert model.n_samples_fit_==len(Xt),'应只用训练集拟合'
    assert model.n_neighbors==k
    assert pred.shape==yv.shape and np.array_equal(pred,model.predict(Xv))
    assert abs(report['accuracy']-accuracy_score(yv,pred))<1e-12
    assert model.predict([[5.0,2.9,1.0,.2]])[0]==0
    print('检查通过。测试准确率：',report['accuracy'])
    print('混淆矩阵：\\n',confusion_matrix(yv,pred))
    print('错误样本索引：',np.flatnonzero(pred!=yv).tolist())
''', '''
def demo_report(Xt,Xv,yt,yv,k=1):
    model=KNeighborsClassifier(n_neighbors=k)
    model.fit(Xt,yt)
    predictions=model.predict(Xv)
    return {'model':model,'predictions':predictions,'accuracy':accuracy_score(yv,predictions)}
report=demo_report(X_train,X_test,y_train,y_test)
check_report(report,1,X_train,X_test,y_train,y_test)
pred=report['predictions']
plt.scatter(X_test[:,0],X_test[:,1],c=pred);plt.xlabel(iris.feature_names[0]);plt.ylabel(iris.feature_names[1]);plt.show()
new_class=report['model'].predict([[5.0,2.9,1.0,.2]])[0]
print('新样本类别：',iris.target_names[new_class])
''', '''
def student_report(Xt,Xv,yt,yv,k=1):
    model=KNeighborsClassifier(n_neighbors=k)
    # TODO 1: 只在训练集 Xt、yt 上调用 fit
    # TODO 2: 对测试集 Xv 调用 predict
    # TODO 3: 用 yv 与预测值计算准确率
    # TODO 4: 返回 {'model':model,'predictions':预测值,'accuracy':准确率}
    return None
''', '''
result=student_report(X_train,X_test,y_train,y_test)
if result is None:print('待完成：补全训练、预测、评估。')
else:check_report(result,1,X_train,X_test,y_train,y_test)
''', '预先固定 k=3、random_state=7，用相同接口独立完成一次分类。报告测试准确率、混淆矩阵与错误样本，不要求分数提高。不要根据测试分数反复选择 k。另用自己的话解释为什么训练和测试要分开。', '''
X_train2,X_test2,y_train2,y_test2=train_test_split(iris.data,iris.target,test_size=.25,random_state=7)
def independent_report(Xt,Xv,yt,yv,k=3):
    # TODO: 独立实现同样的返回接口
    return None
''', '''
result2=independent_report(X_train2,X_test2,y_train2,y_test2)
if result2 is None:print('待完成：完成独立变式。')
else:check_report(result2,3,X_train2,X_test2,y_train2,y_test2)
''', '''
check_report(demo_report(X_train,X_test,y_train,y_test),1,X_train,X_test,y_train,y_test)
check_report(demo_report(X_train2,X_test2,y_train2,y_test2,k=3),3,X_train2,X_test2,y_train2,y_test2)
''', '教材对应 Müller、Guido 第 1 章。Iris 数据随 scikit-learn 提供，不需要下载外部文件。')

    notebook('deep-learning', '两层网络识别手写数字', 'numpy matplotlib scikit-learn', '''
import numpy as np
import matplotlib.pyplot as plt
from sklearn.datasets import load_digits
from sklearn.model_selection import train_test_split
digits=load_digits()
Xt,Xv,yt,yv=train_test_split(digits.data/16.,digits.target,test_size=.25,random_state=0,stratify=digits.target)
def init_net(inputs,hidden,classes,seed=0):
    rng=np.random.default_rng(seed)
    return {'W1':rng.normal(0,np.sqrt(2/inputs),(inputs,hidden)),'b1':np.zeros(hidden),'W2':rng.normal(0,np.sqrt(2/hidden),(hidden,classes)),'b2':np.zeros(classes)}
def forward(p,X):
    z=X@p['W1']+p['b1'];a=np.maximum(z,0)
    logits=a@p['W2']+p['b2'];ex=np.exp(logits-logits.max(axis=1,keepdims=True))
    return z,a,ex/ex.sum(axis=1,keepdims=True)
def loss(p,X,y):
    prob=forward(p,X)[2]
    return -np.log(prob[np.arange(len(y)),y]+1e-12).mean()
def check_gradients(solver):
    rng=np.random.default_rng(4);X=rng.normal(size=(3,4));y=np.array([0,1,2]);p=init_net(4,5,3,3)
    analytic=solver(p,X,y)
    for key in p:
        numeric=np.zeros_like(p[key])
        for index in np.ndindex(p[key].shape):
            original=p[key][index];p[key][index]=original+1e-5;up=loss(p,X,y)
            p[key][index]=original-1e-5;down=loss(p,X,y);p[key][index]=original
            numeric[index]=(up-down)/2e-5
        assert analytic[key].shape==p[key].shape
        error=np.linalg.norm(analytic[key]-numeric)/(np.linalg.norm(analytic[key])+np.linalg.norm(numeric)+1e-7)
        assert error<1e-4,(key,error)
    print('四组梯度通过小网络数值检查。')
def train(gradient,hidden=32,seed=0,steps=240):
    p=init_net(64,hidden,10,seed);rng=np.random.default_rng(seed);history=[]
    for _ in range(steps):
        index=rng.choice(len(Xt),64,replace=False)
        gradients=gradient(p,Xt[index],yt[index])
        for key in p:p[key]-=.12*gradients[key]
        history.append(loss(p,Xt[index],yt[index]))
    print('测试准确率：',np.mean(forward(p,Xv)[2].argmax(axis=1)==yv))
    return p,history
def check_training(result):
    p,history=result
    assert len(history)>20 and np.isfinite(history).all()
    assert np.mean(history[-20:])<np.mean(history[:20])
    assert forward(p,Xv)[2].shape==(len(Xv),10)
    print('训练流程检查通过；还需分析错误样本。')
''', '''
def demo_gradients(p,X,y):
    z,a,prob=forward(p,X)
    dlogits=prob.copy();dlogits[np.arange(len(y)),y]-=1;dlogits/=len(y)
    dW2=a.T@dlogits;db2=dlogits.sum(axis=0)
    dz=(dlogits@p['W2'].T)*(z>0)
    return {'W1':X.T@dz,'b1':dz.sum(axis=0),'W2':dW2,'b2':db2}
network,history=train(demo_gradients)
plt.plot(history);plt.xlabel('step');plt.ylabel('loss');plt.show()
predictions=forward(network,Xv)[2].argmax(axis=1)
for index in np.flatnonzero(predictions!=yv)[:4]:
    plt.imshow(Xv[index].reshape(8,8),cmap='gray');plt.title('true=%d predicted=%d'%(yv[index],predictions[index]));plt.show()
''', '''
def student_gradients(p,X,y):
    z,a,prob=forward(p,X)
    dlogits=prob.copy()
    dlogits[np.arange(len(y)),y]-=1
    dlogits/=len(y)
    # TODO 1: 由 a 与 dlogits 求 W2、b2 的梯度
    # TODO 2: 梯度通过 W2 和 ReLU，得到隐藏层梯度
    # TODO 3: 求 W1、b1 的梯度，返回四个同名键的字典
    return None
''', '''
if student_gradients(init_net(4,5,3),np.ones((3,4)),np.array([0,1,2])) is None:print('待完成：补全四组梯度。')
else:check_gradients(student_gradients)
''', '独立用隐藏层宽度 16、随机种子 7 训练，返回参数和损失历史。可使用已经完成的梯度函数。报告测试准确率并解释至少一张错误数字；不同设置不保证更高分。', '''
def independent_training():
    # TODO: 使用自己实现的梯度函数和 train 完成变式，返回 (参数,损失历史)
    return None
''', '''
changed=independent_training()
if changed is None:print('待完成：独立训练变式。')
else:check_training(changed)
''', '''
check_gradients(demo_gradients)
check_training((network,history))
check_training(train(demo_gradients,hidden=16,seed=7))
''', '依据斋藤康毅教材第 1—5 章。为降低下载与运行负担，使用 scikit-learn 内置的 8×8 手写数字，而非 MNIST。数据来源：UCI Optical Recognition of Handwritten Digits，经 scikit-learn 提供。只用 NumPy 实现网络，scikit-learn 仅负责提供数据与划分。')

    notebook('pytorch', '线性回归的完整训练过程', 'torch', '''
import torch
from torch import nn
from torch.utils.data import TensorDataset,DataLoader
torch.set_num_threads(1)
def make_data(weights,bias,seed=0):
    g=torch.Generator().manual_seed(seed)
    X=torch.randn(1200,2,generator=g)
    y=X@torch.tensor(weights,dtype=torch.float32)+bias+.01*torch.randn(1200,generator=g)
    return X[:1000],y[:1000,None],X[1000:],y[1000:,None]
def run_training(epoch_fn,weights=(2.,-3.4),bias=4.2,seed=0):
    torch.manual_seed(seed);Xt,yt,Xv,yv=make_data(weights,bias,seed)
    loader=DataLoader(TensorDataset(Xt,yt),batch_size=10,shuffle=True)
    model=nn.Linear(2,1);criterion=nn.MSELoss();optimizer=torch.optim.SGD(model.parameters(),lr=.03)
    for _ in range(10):epoch_fn(model,loader,criterion,optimizer)
    with torch.no_grad():mse=criterion(model(Xv),yv).item()
    error=max((model.weight.detach().ravel()-torch.tensor(weights)).abs().max().item(),abs(model.bias.item()-bias))
    return model,mse,error
def check_training(result):
    model,mse,error=result
    assert mse<.01 and error<.1,(mse,error)
    print('检查通过：测试 MSE=',mse,'最大参数误差=',error)
''', '''
def demo_epoch(model,loader,criterion,optimizer):
    for X,y in loader:
        optimizer.zero_grad()
        prediction=model(X)
        error=criterion(prediction,y)
        error.backward()
        optimizer.step()
result=run_training(demo_epoch)
check_training(result)
print('拟合参数：',result[0].weight.detach(),result[0].bias.detach())
''', '''
def student_epoch(model,loader,criterion,optimizer):
    for X,y in loader:
        # TODO: 清零、前向、计算损失、反向、更新
        pass
    # TODO: 全部补好后返回 True
    return None
''', '''
probe=nn.Linear(2,1);loader=DataLoader(TensorDataset(torch.ones(2,2),torch.ones(2,1)),batch_size=1)
if student_epoch(probe,loader,nn.MSELoss(),torch.optim.SGD(probe.parameters(),lr=.03)) is None:print('待完成：补全训练循环。')
else:check_training(run_training(student_epoch))
''', '独立实现训练循环，用真实权重 [-1,0.5]、偏置 -2 和种子 7 重新生成数据、训练并测试。解释每一步的作用。', '''
def independent_epoch(model,loader,criterion,optimizer):
    # TODO: 独立写出训练循环；最后返回 True
    return None
''', '''
probe=nn.Linear(2,1)
if independent_epoch(probe,loader,nn.MSELoss(),torch.optim.SGD(probe.parameters(),lr=.03)) is None:print('待完成：独立训练循环。')
else:check_training(run_training(independent_epoch,weights=(-1.,.5),bias=-2.,seed=7))
''', '''
check_training(run_training(demo_epoch,weights=(-1.,.5),bias=-2.,seed=7))
''', '按《动手学深度学习》第 2 章和 3.1—3.3 节。只在 CPU 运行，数据自行生成。')

    notebook('nlp', '教材简介关键词检索', '', '''
import math,re
from collections import Counter
# 以下为虚构的英文教学简介，不代表文献库中的真实书籍。
DOCUMENTS=[('calculus','Calculus Basics','limit derivative integral function'),('algebra','Matrix Notes','matrix vector basis linear'),('probability','Probability Notes','random event probability distribution')]
def tokens(text):return re.findall(r'[a-z]+',text.lower())
def build_index(documents):
    counts=[Counter(tokens(title+' '+summary)) for _,title,summary in documents]
    vocab=set().union(*(set(row) for row in counts))
    idf={word:1+math.log((len(documents)+1)/(1+sum(word in row for row in counts))) for word in vocab}
    vectors=[{word:count*idf[word] for word,count in row.items()} for row in counts]
    return documents,idf,vectors
def search(index,query,cosine):
    documents,idf,vectors=index;counts=Counter(tokens(query));q={word:count*idf[word] for word,count in counts.items() if word in idf}
    results=[(documents[i][0],cosine(q,vector)) for i,vector in enumerate(vectors)]
    return sorted([row for row in results if row[1]>0],key=lambda row:(-row[1],row[0]))
def check_search(cosine):
    index=build_index(DOCUMENTS)
    for query,expected in [('derivative','calculus'),('matrix','algebra'),('probability','probability')]:assert search(index,query,cosine)[0][0]==expected
    assert search(index,'',cosine)==[] and search(index,'banana',cosine)==[]
    print('三个主题查询及边界情况检查通过。')
def check_extension(index,cosine):
    assert len(index[0])==4
    assert search(index,'eigenvector',cosine)[0][0]=='spectral'
    print('新增简介与重建索引检查通过。')
''', '''
def demo_cosine(a,b):
    length_a=math.sqrt(sum(value*value for value in a.values()))
    length_b=math.sqrt(sum(value*value for value in b.values()))
    if length_a==0 or length_b==0:return 0.
    return sum(value*b.get(word,0) for word,value in a.items())/(length_a*length_b)
index=build_index(DOCUMENTS)
print(search(index,'matrix vector',demo_cosine))
''', '''
def student_cosine(a,b):
    # TODO: 计算余弦相似度，处理零向量
    return None
''', '''
if student_cosine({}, {}) is None:print('待完成：补全余弦相似度。')
else:check_search(student_cosine)
''', '增加一条 spectral 简介，标题为 Spectral Notes，简介包含 eigenvector eigenvalue matrix，重建词表与 IDF。用自己的余弦函数检索新词。', '''
def independent_index():
    # TODO: 返回加入新简介后重新构建的索引
    return None
''', '''
extended=independent_index()
if extended is None:print('待完成：添加简介并重建索引。')
else:check_extension(extended,student_cosine)
''', '''
check_search(demo_cosine)
extended=build_index(DOCUMENTS+[('spectral','Spectral Notes','eigenvector eigenvalue matrix')])
check_extension(extended,demo_cosine)
''', '按 NLP in Action 第二版第 2—3 章。纯 Python，无语料或模型下载。')

    notebook('llm', '教材简介整理助手', '', '''
import json,os,getpass,urllib.request
# 虚构教学材料；默认只处理保存的示例响应，不会连接或计费。
INTRO='书名：线性代数练习。主题：矩阵、线性方程组。需要基础：基本代数运算。'
SAMPLE_REPLY='{"title":"线性代数练习","topics":["矩阵","线性方程组"],"prerequisites":["基本代数运算"]}'
UNKNOWN_REPLY='{"title":"分析札记","topics":["导数"],"prerequisites":null}'
def call_model(prompt):
    # 只有你明确调用本函数才会联网。不要把管理员默认密钥复制到电脑。
    base=os.environ.get('AXIOM_AI_BASE_URL','').rstrip('/')
    model=os.environ.get('AXIOM_AI_MODEL','')
    if not base or not model:raise ValueError('先设置自己的 AXIOM_AI_BASE_URL 与 AXIOM_AI_MODEL')
    if not base.startswith('https://'):raise ValueError('真实调用请使用服务商的 HTTPS 兼容 API 地址')
    key=os.environ.get('AXIOM_AI_API_KEY') or getpass.getpass('你的个人 API 密钥（不回显）：')
    payload={'model':model,'messages':[{'role':'user','content':prompt}]}
    request=urllib.request.Request(base+'/chat/completions',data=json.dumps(payload).encode(),headers={'Content-Type':'application/json','Authorization':'Bearer '+key},method='POST')
    with urllib.request.urlopen(request,timeout=60) as response:body=json.load(response)
    text=body.get('choices',[{}])[0].get('message',{}).get('content')
    if not isinstance(text,str):raise ValueError('模型未返回文本回答，请检查模型与接口格式')
    return text
def check_parser(parser):
    card=parser(SAMPLE_REPLY)
    assert card==json.loads(SAMPLE_REPLY)
    assert parser(UNKNOWN_REPLY)['prerequisites'] is None
    for bad in ['not json','{"title":1,"topics":[],"prerequisites":null}','{"title":"x","topics":"matrix","prerequisites":null}']:
        try:parser(bad)
        except (ValueError,TypeError):pass
        else:raise AssertionError('应拒绝错误格式')
    print('格式检查通过；内容是否来自原文仍需人工逐项核对。')
''', '''
def demo_parser(raw):
    card=json.loads(raw)
    if not isinstance(card,dict) or set(card)!={'title','topics','prerequisites'}:raise ValueError('字段不完整或存在额外字段')
    if card['title'] is not None and not isinstance(card['title'],str):raise ValueError('title 必须为文本或 null')
    for name in ['topics','prerequisites']:
        value=card[name]
        if value is not None and (not isinstance(value,list) or any(not isinstance(item,str) for item in value)):raise ValueError(name+' 必须为文本列表或 null')
    return card
PROMPT='只根据简介抽取 title、topics、prerequisites。只输出 JSON。title 为文本或 null，另两项为文本列表或 null；未提及的内容填 null，不猜测。简介：'+INTRO
print('当前模式：离线示例响应，尚未调用真实模型。')
print(demo_parser(SAMPLE_REPLY))
# 真实调用二选一：
# 1. 在平台教材阅读器用管理员默认 API 提问，将原始回答粘贴进变量再解析。
# 2. 配好你自己的 API 后，主动执行：raw_reply=call_model(PROMPT)
''', '''
def student_parser(raw):
    card=json.loads(raw)
    # TODO 1: 检查字段恰好是 title、topics、prerequisites
    # TODO 2: title 是文本或 None，另两项是文本列表或 None
    # TODO 3: 格式错误时抛出 ValueError，通过时返回 card
    return None
''', '''
if student_parser(SAMPLE_REPLY) is None:print('待完成：补全格式检查。')
else:check_parser(student_parser)
''', '换成简介“书名：分析札记。主题：导数。”，写出提示词并检查结果。原文没有给出先修条件，必须保留 null。先用示例响应检查程序，再完成一次真实模型调用并记录原文、提示与原始回答；无 API 时只能标记程序部分完成。', '''
def independent_card(raw):
    # TODO: 使用自己实现的解析器处理回答，并核对本次已知的内容
    return None
''', '''
card=independent_card(UNKNOWN_REPLY)
if card is None:print('待完成：独立核对新简介；真实 API 实验另行完成。')
else:
    assert card['title']=='分析札记' and card['topics']==['导数'] and card['prerequisites'] is None
    print('离线变式通过；这不表示已经验证真实模型。')
''', '''
check_parser(demo_parser)
assert demo_parser(UNKNOWN_REPLY)['prerequisites'] is None
print('参考提示：只抽取原文明确给出的信息，未提及的 prerequisites 必须为 null。')
''', '按 Hands-On Large Language Models 的 Prompt Engineering 章。联网可能产生服务商费用。Notebook 默认不联网、不保存密钥；离线结果不能冒充真实模型实验。')


if __name__ == '__main__':
    build()
    print('Built 8 staged learning notebooks.')
