import json, pathlib
s = pathlib.Path('build/src')
data = {}
data.update(json.loads((s/'data_small.json').read_text()))
data.update(json.loads((s/'data_text.json').read_text()))
data['districts'] = json.loads((s/'districts.json').read_text())
d3 = pathlib.Path('build/vendor/d3.min.js').read_text()
def safe(js): return js.replace('</script', '<\\/script')
html = f"""<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>John Kim | 토론토 부동산 시장 리포트 · Toronto Market Report</title>
<meta name="description" content="토론토·GTA 부동산 시장 데이터를 한국어로. TRREB 거래 가격, 동네별 시세, 판매 속도, 모기지 금리와 계산기. John Kim, Broker · Bay Street Group Inc., Brokerage.">
<meta property="og:title" content="John Kim | Toronto Market Report · 토론토 부동산 시장 리포트">
<meta property="og:description" content="TRREB 2026년 9월 거래 자료, 동네별 시세, 판매 속도, 모기지 정보를 한곳에.">
<meta property="og:type" content="website">
<meta property="og:url" content="https://www.johnkimrealtor.com/">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@400;600;700;800&display=swap" rel="stylesheet">
<style>
{(s/'style.css').read_text()}
</style>
</head>
<body>
{(s/'body.html').read_text()}
<script>{safe(d3)}</script>
<script>window.JK_DATA = {safe(json.dumps(data, ensure_ascii=False))};</script>
<script>
{safe((s/'shim.js').read_text())}
{safe((s/'app.js').read_text())}
{safe((s/'charts.js').read_text())}
{safe((s/'edu.js').read_text())}
</script>
</body>
</html>
"""
out = pathlib.Path('.')
(out/'index.html').write_text(html)
print(len(html))
