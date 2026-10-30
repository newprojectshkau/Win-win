#!/usr/bin/env python3
"""Create a standalone private HTML simulator with embedded dataset and modules."""
import argparse,json,re
from pathlib import Path
p=argparse.ArgumentParser(description=__doc__)
p.add_argument('--dataset',required=True);p.add_argument('--output',required=True)
a=p.parse_args();root=Path(__file__).resolve().parents[2];site=root/'sites/g3-platform';out=Path(a.output).resolve()
if out==root or root in out.parents:p.error('Private review must stay outside the public repository')
data=json.loads(Path(a.dataset).read_text())
if data.get('kind')!='imported':p.error('Expected imported dataset')
html=(site/'simulator.html').read_text()
for name in ['styles.css','simulator.css']:
 html=re.sub(r'<link rel="stylesheet" href="\./'+re.escape(name)+r'[^"\n]*">',lambda _: '<style>'+(site/name).read_text()+'</style>',html)
modules=[]
for name in ['engine.js','performance.js','dataset-store.js','quality-audit.js','charts.js','presentation.js','simulator.js']:
 source=(site/name).read_text()
 source=re.sub(r'^import .*?;\s*','',source,flags=re.M)
 source=re.sub(r'^export ', '',source,flags=re.M)
 # Local module concatenation: isolate page helpers from engine helpers.
 if name=='simulator.js':source='{\n'+source+'\n}'
 modules.append(source)
script='<script id="private-dataset" type="application/json">'+json.dumps(data,separators=(',',':')).replace('<','\\u003c')+'</script><script type="module">'+'\n'.join(modules)+'</script>'
html=re.sub(r'<script type="module" src="[^"\n]+"></script>',lambda _:script,html)
html=html.replace('href="./review.html"','href="https://newprojectshkau.github.io/Win-win/"')
out.parent.mkdir(parents=True,exist_ok=True);out.write_text(html);out.chmod(0o600)
print(json.dumps({'privateReview':str(out),'bytes':out.stat().st_size}))
