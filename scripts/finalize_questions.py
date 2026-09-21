import json,re
from pathlib import Path
root=Path(__file__).resolve().parents[1];data=root/'web/data/questions.json'
qs=json.loads(data.read_text(encoding='utf-8'))
ex=json.loads((root/'.local/codex-explanations.json').read_text(encoding='utf-8-sig'))
insert={
'D-mock1-007':('against correlations','against _____ correlations'),
'D-mock1-008':('albeit way','albeit _____ way'),
'D-mock1-011':('would be .','would be _____.'),
'D-mock1-012':('and thus the','and thus _____ the'),
'D-mock1-017':('programs that or','programs that _____ or'),
'D-mock1-021':('the most .','the most _____.'),
'D-mock1-030':('were not :','were not _____:'),
'D-mock1-047':('sources are so that','sources are so _____ that'),
'D-mock1-048':('does not seem to carry','does not seem _____ to carry'),
'D-mock1-049':('acted as a ,','acted as a _____,'),
'D-mock1-050':('is far more than','is far more _____ than'),
'D-mock2-002':('astronomy is :','astronomy is _____:'),
'D-mock2-008':('performances is :','performances is _____:'),
'D-mock2-009':('While the of reliable','While the _____ of reliable'),
'D-mock2-010':('has been by scholars','has been _____ by scholars'),
'D-mock2-011':('by the that','by the _____ that'),
'D-mock2-017':('historians have the disjunction','historians have _____ the disjunction'),
'D-mock2-018':('boundary is to space','boundary is _____ to space'),
'D-mock2-019':('solar panels nature','solar panels _____ nature'),
'D-mock2-020':('relative of records','relative _____ of records'),
'D-mock2-021':('introducing note','introducing _____ note'),
'D-mock2-022':('often behind','often _____ behind'),
'D-mock2-029':('lacked demeanor','lacked _____ demeanor'),
'D-mock2-030':('would be .','would be _____.'),
'D-mock2-031':('dominated by .','dominated by _____.'),
'D-mock2-032':('illustrate the of science','illustrate the _____ of science'),
'D-mock2-040':('sounds is compared','sounds is _____ compared'),
'D-mock2-047':('traditionally ,','traditionally _____,'),
'D-mock2-048':('becomes when','becomes _____ when'),
'D-mock2-049':('was not ,','was not _____,'),
}
quarantine={
'B-course-130':'六選二題的原答案表僅列 C，缺少第二個答案，暫待核對。',
'B-basic-130':'答案 AC 同屬第一格選項；雙格題無第二格答案。',
'B-basic-150':'答案 DE 同屬第二格選項；雙格題無第一格答案。',
'D-medium-069':'原答案 D（relevant）與 nevertheless 轉折不協調；待核對。',
'D-mock2-006':'原答案 CFG 與依解說需要分配篇幅的句意不協調；待核對。',
'D-mock3-035':'原答案第一格 B（compact）與空間可依需求改變的線索不協調；待核對。',
'D-mock4-020':'原答案 BE 與支持度波動的語意不協調；待核對。',
'D-mock4-039':'原講義「fabricated entirely _____ for fossils」疑似缺少名詞，題幹待核對。',
}
cleanup={
'B-basic-121':('F','displacement'),
'C-course-048':('I','endangered'),
'C-course-096':('F','deterioration'),
'D-hard-004':('I','insufficient'),
'D-hard-050':('F','implausible'),
}
for q in qs:
 q['codexExplanation']=ex.get(q['id'],'')
 if q['id']=='C-homework-112':
  q['options'][-1]['text']='circumscribed';q['options'].append({'id':'F','text':'illustrious'});q['kind']='equivalence'
 if q['id']=='D-mock1-027':
  q['answers']=[['A','B'],['A','E'],['B','E']]
  q['notes']='答案表註記：A、B、E 皆有理，屬爭議題。本題為六選二，A、B、E 中任選兩項計為正確。'
 if q['id'] in insert:
  a,b=insert[q['id']];assert a in q['stem'],q['id'];q['stem']=q['stem'].replace(a,b,1)
 if q['id']=='D-mock1-033':
  q['stem']=q['stem'].replace('what passes for independent filmmaking. the whimsy','the whimsy')
  q['editorialNote']='原講義重複的「what passes for independent filmmaking.」片段已移除；原題 PDF 第 92 頁可供核對。'
 if q['id']=='D-mock2-026':
  pos=q['stem'].rfind('(ii)');q['stem']=q['stem'][:pos]+q['stem'][pos:].replace('(ii)','(iii)',1)
  q['editorialNote']='原講義最後一格重複標為 (ii)，依三欄選項整理為 (iii)。'
 q['stem']=re.sub(r'(\((?:i|ii|iii)\))\s*(?![_\s])',r'\1 _____ ',q['stem'])
 if q['id'] in cleanup:
  letter,value=cleanup[q['id']];o=next(o for o in q['options'] if o['id']==letter)
  extra=o['text'][len(value):].strip();q['notes']=(extra+'\n'+q['notes']).strip();o['text']=value
 if q['id'] in quarantine:q['valid']=False;q['issue']=quarantine[q['id']]
 for o in q['options']:
  o['text']=re.sub(r'\s*\([+-]$','',o['text']).strip()
 # Break original annotations into readable paragraphs without changing their content.
 q['notes']=re.sub(r'\s+(?=\[(?:義|類|反|例|記法|英英|英|字根|提示)\]|<補充?\d+>)','\n',q['notes'])
assert len(qs)==1175
assert all('_' in q['stem'] for q in qs)
assert all(q['notes'].strip() or q['codexExplanation'] for q in qs if q['valid'])
assert len(ex)==329,len(ex)
data.write_text(json.dumps(qs,ensure_ascii=False,indent=2),encoding='utf-8')
summary={b:{'total':sum(q['bank']==b for q in qs),'available':sum(q['bank']==b and q['valid'] for q in qs)} for b in ['B','C','D']}
(root/'.local/import-report.json').write_text(json.dumps({'counts':summary,'codexExplanations':len(ex),'quarantined':quarantine},ensure_ascii=False,indent=2),encoding='utf-8')
print(summary,'codex',len(ex))

