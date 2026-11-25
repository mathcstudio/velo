# src/ 의 CSS·데이터·앱 코드를 합쳐 (1) 깃허브 페이지용 index.html (2) 미리보기용 preview.html 을 만든다
import io
r=lambda f: io.open('src/'+f,encoding='utf-8').read()
css,lesson,appjs=r('app.css'),r('lesson.js'),r('app.js')
for n,js in (('lesson',lesson),('app',appjs)): assert '</script' not in js, n
FONT='<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Jua&family=Gowun+Dodum&family=Gaegu:wght@400;700&family=Noto+Sans+KR:wght@400;500;700&display=swap">'
MJCFG='''<script>
window.MathJax = { tex: { inlineMath: [["\\\\(", "\\\\)"]] }, svg: { fontCache: "global" }, startup: { typeset: false,
  ready: function () { MathJax.startup.defaultReady(); MathJax.startup.promise.then(function () { window.__mjReady = true; window.__typeset && window.__typeset(); }); } } };
</script>'''
MJ='<script src="https://cdn.jsdelivr.net/npm/mathjax@3.2.2/es5/tex-svg.js" async></script>'
body='<div class="wrap" id="app"></div>\n'+MJCFG+'\n<script>\n'+lesson+'\n</script>\n<script>\n'+appjs+'\n</script>\n'+MJ+'\n'
TITLE='위치의 변화량과 움직인 거리'
HEAD='<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n<title>'+TITLE+'</title>\n'
# 깃허브 페이지용: config.js(서버 주소)를 앱 코드보다 먼저 읽는다
page='<!DOCTYPE html>\n<html lang="ko">\n<head>\n'+HEAD+FONT+'\n<style>\n'+css+'</style>\n<script src="config.js"></script>\n</head>\n<body>\n'+body+'</body>\n</html>\n'
io.open('index.html','w',encoding='utf-8').write(page)
prev='<title>'+TITLE+' 미리보기</title>\n<meta name="claude:viewport-fit-sides" content="cover">\n'+FONT+'\n<style>\n'+css+'</style>\n'+body
io.open('preview.html','w',encoding='utf-8').write(prev)
print(len(page),len(prev))
