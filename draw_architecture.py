from PIL import Image, ImageDraw, ImageFont
from pathlib import Path
import math

out = Path(__file__).parent
im = Image.new('RGB', (1500, 1000), '#f5f7fb')
d = ImageDraw.Draw(im)
def font(size, bold=False):
    return ImageFont.truetype('C:/Windows/Fonts/msyhbd.ttc' if bold else 'C:/Windows/Fonts/msyh.ttc', size)
def text(x,y,s,size=26,color='#29364b',bold=False):
    d.text((x,y),s,font=font(size,bold),fill=color,anchor='mm')
def box(rect,title,lines,fill='#ffffff',border='#d5dfeb'):
    d.rounded_rectangle(rect,radius=22,fill=fill,outline=border,width=2)
    x=(rect[0]+rect[2])/2
    text(x,rect[1]+42,title,30,bold=True)
    for i,line in enumerate(lines):
        text(x,rect[1]+90+i*38,line,24,color='#52637a')
def arrow(points,color='#6a7f9c'):
    d.line(points,fill=color,width=4,joint='curve')
    x,y=points[-1]; px,py=points[-2]
    a=math.atan2(y-py,x-px)
    d.polygon([(x,y),(x-15*math.cos(a-.5),y-15*math.sin(a-.5)),(x-15*math.cos(a+.5),y-15*math.sin(a+.5))],fill=color)

text(750,62,'数学研究平台 · 简化架构',40,bold=True)
box((470,115,1030,245),'首页',['专业模块与应用入口'],fill='#eaf1ff',border='#b6cbee')
arrow([(750,245),(750,280),(365,280),(365,315)])
arrow([(750,245),(750,280),(1135,280),(1135,315)])
box((80,315,650,535),'数学专业模块',['代数 · 数论 · 分析','几何与拓扑 · 其他数学方向'])
box((860,315,1410,535),'扩展应用区',['预留后续研发模块'])
arrow([(650,425),(705,425)])
text(750,390,'调用',21)
box((705,405,825,535),'AI',[],fill='#eeebff',border='#c9c0ee')
text(765,495,'助手',25,bold=True)
arrow([(365,535),(365,655)])
text(285,592,'直接访问',23)
arrow([(765,535),(765,655)],'#8873b9')
text(850,592,'检索与问答',23,color='#78609e')
arrow([(1135,535),(1135,655)])
text(1220,592,'共享底层',23)
box((180,655,1320,845),'共享底层',['统一文献库：文献信息与 PDF','基础服务：上传 · 分类 · 搜索'],fill='#eaf6f0',border='#b3d9c5')
text(765,562,'',20)
text(750,910,'AI 助手预留模型接口；专业模块与 AI 共用一个文献库。',25)
im.save(out/'数学研究平台-简化架构.png')
