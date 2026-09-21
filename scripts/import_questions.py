import json,re,unicodedata
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
LOCAL=ROOT/'.local'
def load(b,k):return json.loads((LOCAL/f'{b}-{k}.json').read_text(encoding='utf-8'))
def norm(t):return unicodedata.normalize('NFKC',t).replace('\x00','')
def clean(t):return re.sub(r'\s+',' ',norm(t)).strip()
def blocks(t):return re.split(r'(?:題號\s+答案\s*)+',norm(t))[1:]
def answer(t):return {int(n):''.join(sorted(a)) for n,a in re.findall(r'(?<!\d)(\d{1,3})\s+([A-I]{1,3})(?![A-Za-z])',norm(t))}
b=load('b','answers');c=load('c','answers');d=load('d','answers')
specs=[
('B','course','培訓課程',21,180,190,answer(b[0]+b[1])),
('B','basic','基礎作業',185,277,171,answer(b[2]+blocks(b[3])[0])),
('B','advanced','進階作業',278,360,141,answer(blocks(b[3])[1]+b[4])),
('C','course','衝刺課程',11,121,112,answer(c[0])),
('C','homework','衝刺作業',122,237,170,answer(c[1]+c[2])),
('D','medium','Medium',2,49,113,answer(d[0])),
('D','hard','Hard',50,82,78,answer(d[1])),
('D','mock1','模考 1',83,97,50,answer(blocks(d[2])[0])),
('D','mock2','模考 2',98,112,50,answer(blocks(d[2])[1])),
('D','mock3','模考 3',113,127,50,answer(blocks(d[3])[0])),
('D','mock4','模考 4',128,142,50,answer(blocks(d[3])[1])),
]
questions=[];issues=[]
optpat=re.compile(r'(?<![A-Za-z])(?:\(([A-I])\)|([A-I])\.)\s*')
for bank,section,title,start,end,count,answers in specs:
 pages=load(bank.lower(),'book')
 text=''; offsets=[]
 for pi in range(start-1,end):
  p=norm(pages[pi]);p=re.sub(r'^.*?第\s*\d+\s*頁[ \t]*\n?','',p,count=1)
  offsets.append((len(text),pi+1))
  if bank=='D' and section=='mock3' and pi==123:p=re.sub(r'^9\.', '39.',p.lstrip(),count=1)
  text+=p+'\n'
 matches=list(re.finditer(r'(?<![\w.])(\d{1,3})\.\s+',text))
 selected=[];expected=1
 for m in matches:
  if int(m[1])==expected and optpat.search(text[m.end():m.end()+3000]):
   selected.append(m);expected+=1
 if len(selected)!=count:issues.append([bank,section,'count',len(selected),count,expected])
 for ix,m in enumerate(selected):
  n=int(m[1]);chunk=text[m.end():selected[ix+1].start() if ix+1<len(selected) else len(text)]
  opts=[];seen=set();om=[]
  for x in optpat.finditer(chunk):
   letter=x[1] or x[2]
   if letter in seen:break
   if not seen and letter!='A':continue
   seen.add(letter);om.append(x)
   if len(seen)==9:break
  if not om:issues.append([bank,section,n,'no choices']);continue
  stem=chunk[:om[0].start()]
  stem=re.sub(r'Blank\s*\([ivx]+\)\s*','',stem,flags=re.I)
  note_parts=[]
  for oi,x in enumerate(om):
   raw=chunk[x.end():om[oi+1].start() if oi+1<len(om) else len(chunk)]
   # Options are a short English phrase; following Chinese annotations and vocabulary entries belong to review.
   cut=re.search(r'(?:\t[ \t]+\s*|\n|[\u4e00-\u9fff<\[]|(?<=\s)\d+\s+[A-Za-z])',raw)
   value=raw[:cut.start()] if cut else raw
   value=clean(value).strip(' ()')
   opts.append({'id':x[1] or x[2],'text':value})
   if cut and raw[cut.start():].strip():note_parts.append(raw[cut.start():])
  opts.sort(key=lambda x:x['id'])
  choices=len(opts);key=answers.get(n)
  blanks=3 if choices==9 else (2 if choices==6 and re.search(r'\(ii\)',stem,re.I) else 1)
  kind='equivalence' if choices==6 and blanks==1 else 'completion'
  page=max(p for off,p in offsets if off<=m.start())
  # Include original explanation/hints after the options. Never fabricate an explanation.
  notes=clean('\n'.join(note_parts))
  notes=re.sub(r'參考答案\s*[:：]?\s*','',notes).strip()
  notes=re.sub(r'(?:回家練習|同義關係|反義關係|單元[一二三四五六七八九十]).*$', '',notes).strip()
  if len(notes)>9000:notes=notes[:9000]
  valid=key is not None and choices in [5,6,9] and all(o['text'] for o in opts) and all(k in seen for k in key)
  if kind=='completion' and blanks>1:valid=valid and len(key or '')==blanks and all(sum(k in group for k in key)==1 for group in ['ABC','DEF','GHI'][:blanks])
  accepted=[list(key)] if key else []
  disputed=bank=='D' and section=='mock1' and n==27
  if disputed:
   accepted=[['A'],['B'],['E']]
   notes='答案表註記：本題 A、B、E 皆有理，屬爭議題。單選 A、B 或 E 均計為正確。'+notes
  if not valid:issues.append([bank,section,n,choices,key,[(o['id'],o['text'][:40]) for o in opts]])
  questions.append(dict(id=f'{bank}-{section}-{n:03}',bank=bank,section=title,number=n,page=page,stem=clean(stem),options=opts,kind=kind,blanks=blanks,answers=accepted,notes=notes,disputed=disputed,valid=valid))
out=ROOT/'web'/'data';out.mkdir(exist_ok=True)
(out/'questions.json').write_text(json.dumps(questions,ensure_ascii=False,indent=2),encoding='utf-8')
(LOCAL/'import-issues.json').write_text(json.dumps(issues,ensure_ascii=False,indent=2),encoding='utf-8')
print('Total',len(questions),'valid',sum(q['valid'] for q in questions),'with notes',sum(len(q['notes'])>30 for q in questions))
print(json.dumps(issues,ensure_ascii=False,indent=2))

