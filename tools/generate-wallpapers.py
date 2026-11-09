# Regenerates the built-in wallpapers (web/wallpapers). Needs: pip install numpy scipy matplotlib pillow
# Output folder can be overridden with WALLPAPER_OUT=/some/dir/
import os, numpy as np, matplotlib
matplotlib.use('Agg'); import matplotlib.pyplot as plt
from PIL import Image
from scipy.ndimage import gaussian_filter, zoom
W,H=2560,1440; OUT=os.environ.get('WALLPAPER_OUT') or os.path.join(os.path.dirname(os.path.abspath(__file__)),'..','web','wallpapers')+'/'
os.makedirs(OUT+'thumbs',exist_ok=True)
yy=np.arange(H,dtype=np.float32)[:,None]; xx=np.arange(W,dtype=np.float32)[None,:]
def hx(h): h=h.lstrip('#'); return np.array([int(h[i:i+2],16) for i in (0,2,4)],np.float32)
def vgrad(stops):
    ys=np.linspace(0,1,H); p=[s[0] for s in stops]; c=np.stack([hx(s[1]) for s in stops])
    o=np.stack([np.interp(ys,p,c[:,k]) for k in range(3)],1).astype(np.float32)
    return np.repeat(o[:,None,:],W,1)
def blob(img,cx,cy,r,col,a=1.0):
    m=np.exp(-(((xx-cx*W)**2+(yy-cy*H)**2)/(r*r))*1.2)*a
    img[:]=img*(1-m[...,None])+hx(col)*m[...,None]
def glow(img,cx,cy,r,col,s=1.0):
    m=np.exp(-(((xx-cx*W)**2+(yy-cy*H)**2)/(r*r))*1.5)*s
    img[:]=np.clip(img+hx(col)*m[...,None],0,255)
def noise1d(n,oct_,pers,f,seed):
    r=np.random.default_rng(seed); x=np.linspace(0,1,n); out=np.zeros(n); amp=1.0; tot=0
    for _ in range(oct_):
        pts=r.random(int(f)+2); xi=x*f; i=np.floor(xi).astype(int); t=(1-np.cos((xi-i)*np.pi))/2
        out+=amp*(pts[i]*(1-t)+pts[i+1]*t); tot+=amp; amp*=pers; f*=2
    return out/tot
def ridge(img,base,amp,top,bot,seed,freq=3,oct_=6,pers=.55):
    n=noise1d(W,oct_,pers,freq,seed); y=base*H+(n-.5)*amp*H
    a=np.clip(yy-y[None,:]+.5,0,1); y0=base*H-amp*H/2
    t=np.clip((yy-y0)/(H-y0),0,1)[...,None]; col=hx(top)*(1-t)+hx(bot)*t
    img[:]=img*(1-a[...,None])+col*a[...,None]
def fog(img,y0,h,a,col='#cfe6e0'):
    m=(np.exp(-((yy/H-y0)/h)**2)*a)[...,None]; img[:]=img*(1-m)+hx(col)*m
def stars(img,n,ymax,seed):
    r=np.random.default_rng(seed); l=np.zeros((H,W),np.float32)
    l[(r.random(n)**1.4*ymax*H).astype(int),r.integers(0,W,n)]=(r.random(n)**3)*255
    img[:]=np.clip(img+gaussian_filter(l,.9)[...,None]*3.2,0,255)
def finish(img,name,vig=.25,grain=2.2):
    v=1-vig*(((xx/W-.5)**2+(yy/H-.5)**2)*2); img*=v[...,None]
    img+=np.random.default_rng(3).normal(0,grain,(H,W,1)).astype(np.float32)
    im=Image.fromarray(np.clip(img,0,255).astype(np.uint8)); im.save(OUT+name+'.jpg',quality=80,optimize=True,progressive=True,subsampling=2)
    im.resize((320,180),Image.LANCZOS).save(OUT+'thumbs/'+name+'.jpg',quality=78)
# 1 dusk ridges
i=vgrad([(0,'#1b1740'),(.45,'#5b3a8c'),(.7,'#d96c6c'),(.84,'#f4a76b')]); glow(i,.62,.66,520,'#ffb877',.55)
for k,(b,a,t,bt) in enumerate([(.64,.10,'#8a5a9c','#6b4688'),(.71,.13,'#5e3f80','#442e66'),(.78,.14,'#40295f','#2b1c47'),(.86,.14,'#2a1a45','#190f2e'),(.95,.12,'#150c26','#0b0617')]): ridge(i,b,a,t,bt,10+k,3+k)
finish(i,'dusk-ridges')
# 2 midnight dunes
i=vgrad([(0,'#04060f'),(.7,'#0d1b3a'),(1,'#16284f')]); stars(i,1800,.6,5); glow(i,.75,.2,260,'#9db8ff',.35)
m=np.clip(1-(np.sqrt((xx-.75*W)**2+(yy-.2*H)**2)-46),0,1)[...,None]; i[:]=i*(1-m)+hx('#eef3ff')*m
for k,(b,a,t,bt) in enumerate([(.7,.08,'#1b2d5c','#13234a'),(.78,.09,'#142348','#0d1938'),(.87,.1,'#0d1a38','#08122a'),(.95,.08,'#070f24','#030813')]): ridge(i,b,a,t,bt,30+k,1.6+k*.4,3,.5)
finish(i,'midnight-dunes',.3)
# 3 indigo mesh
i=np.full((H,W,3),hx('#0b0d1f'),np.float32)
for c in [(.2,.15,760,'#5e5ce6',.95),(.85,.88,820,'#0a84ff',.9),(.78,.2,520,'#bf5af2',.55),(.3,.9,500,'#30c8c0',.35)]: blob(i,*c)
finish(i,'indigo-mesh',.3,2.6)
# 4 aurora
i=vgrad([(0,'#02050b'),(1,'#0a1830')]); stars(i,1400,.55,8); o=np.zeros((H,W,3),np.float32)
for k,(yc,am,lo,hi,wd,it) in enumerate([(.34,.22,'#3be8a8','#7a5cff',.14,1.0),(.28,.18,'#2bd6c8','#c85cff',.11,.7),(.42,.15,'#52f0a0','#3b82ff',.1,.55)]):
    c=(yc+(noise1d(W,4,.5,2,40+k)-.5)*am)*H; rays=.5+.5*noise1d(W,5,.6,18,60+k); d=(yy-c[None,:])/(wd*H)
    p=np.where(d>0,np.exp(-(d*3.2)**2),np.exp(-(d*.9)**2))*rays[None,:]; t=np.clip(-d/1.6,0,1)[...,None]
    o+=p[...,None]*(hx(lo)*(1-t)+hx(hi)*t)*it
i=np.clip(i+gaussian_filter(o,(6,3,0)),0,255); ridge(i,.9,.08,'#03070d','#010306',50,2.2,4); ridge(i,.97,.05,'#010204','#010204',51,3,4)
finish(i,'aurora',.3)
# 5 topo
f=zoom(gaussian_filter(np.random.default_rng(11).normal(size=(72,128)),6,mode='wrap'),20,order=3)
fig=plt.figure(figsize=(25.6,14.4),dpi=100); ax=fig.add_axes([0,0,1,1]); ax.axis('off'); fig.patch.set_facecolor('#0c0f14')
lv=np.linspace(f.min(),f.max(),44); ax.contour(f,levels=lv,colors=['#3a5382'],linewidths=1.0,alpha=.5); ax.contour(f,levels=lv[::5],colors=['#6f95d6'],linewidths=1.5,alpha=.65)
ax.set_xlim(0,W); ax.set_ylim(H,0); fig.canvas.draw(); i=np.asarray(fig.canvas.buffer_rgba())[:,:,:3].astype(np.float32).copy(); plt.close(fig)
glow(i,.5,.1,900,'#243a66',.5); finish(i,'topography',.4,1.8)
# 6 violet waves
i=vgrad([(0,'#0b1233'),(1,'#1b2f6b')]); x=np.linspace(0,1,W)
for k,(b,t,bt,a) in enumerate([(.42,'#2f2f8a','#1f1f66',.07),(.52,'#4a35a0','#2e2478',.08),(.62,'#6a3fb0','#43297f',.08),(.73,'#8e4cb8','#5a2f86',.07),(.85,'#b4569f','#6c2f6c',.06)]):
    y=H*(b+a*np.sin(2*np.pi*(x*(1.1+.35*k)+.2*k))+.03*np.sin(2*np.pi*(x*3.1+k)))
    m=np.clip(yy-y[None,:]+.5,0,1); t0=np.clip((yy-y.min())/(H-y.min()),0,1)[...,None]
    i[:]=i*(1-m[...,None]*.96)+(hx(t)*(1-t0)+hx(bt)*t0)*m[...,None]*.96
    i[:]=np.clip(i+np.exp(-((yy-y[None,:])/7)**2)[...,None]*hx('#c9b8ff')*.28,0,255)
finish(i,'violet-waves',.3)
# 7 forest mist
i=vgrad([(0,'#0c2230'),(.55,'#2c5f66'),(.85,'#7fb8a6')])
for k,(b,a,t,bt) in enumerate([(.58,.12,'#5a9a8a','#4b8a7a'),(.67,.14,'#3f8070','#34705f'),(.76,.16,'#2a6455','#1f5246'),(.86,.16,'#1a4a40','#123831'),(.96,.12,'#0f322d','#08201d')]):
    ridge(i,b,a,t,bt,70+k,2.5+k*.7,6,.5)
    if k<4: fog(i,b+.03,.045,.32-.04*k)
finish(i,'forest-mist',.3)
# 8 rose haze
i=np.full((H,W,3),hx('#14081f'),np.float32)
for c in [(.2,.25,720,'#ff4d7d',.85),(.8,.3,820,'#9b4dff',.8),(.55,.95,640,'#ff9f4d',.5),(.08,.9,640,'#4d6dff',.55)]: blob(i,*c)
finish(i,'rose-haze',.3,2.6)
# 9 graphite
i=vgrad([(0,'#1c1c20'),(1,'#0d0d10')]); glow(i,.5,-.05,1000,'#5a5a66',.28); finish(i,'graphite',.4,2.4)
