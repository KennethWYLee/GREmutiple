"""Extract user-provided textbooks locally; never persist the password."""
import getpass,json
from pathlib import Path
from pypdf import PdfReader
root=Path(__file__).resolve().parents[1]
out=root/'.local';out.mkdir(exist_ok=True)
password=getpass.getpass('PDF password: ')
for f in sorted(root.glob('*.pdf')):
    if f.name[0].lower() not in 'bcd':continue
    reader=PdfReader(f)
    if reader.is_encrypted and not reader.decrypt(password):
        raise ValueError(f'Unable to unlock {f.name}')
    pages=[p.extract_text() or '' for p in reader.pages]
    name=f.name[0].lower()+('-answers' if len(pages)<10 else '-book')
    (out/(name+'.json')).write_text(json.dumps(pages,ensure_ascii=False),encoding='utf-8')
    print(name,len(pages))

