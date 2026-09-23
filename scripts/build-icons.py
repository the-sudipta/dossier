"""Convert the approved transparent master without changing its design.
Requires Pillow. This only resizes and converts image formats.
"""
from pathlib import Path
from PIL import Image
root=Path(__file__).resolve().parents[1]
image=Image.open(root/'branding/dossier-master.png').convert('RGBA')
assert image.getchannel('A').getextrema()==(0,255),'Master must contain true transparency'
icons=root/'src-tauri/icons';icons.mkdir(parents=True,exist_ok=True)
for size,name in [(32,'32x32.png'),(128,'128x128.png'),(256,'128x128@2x.png'),(512,'icon.png')]:
    image.resize((size,size),Image.Resampling.LANCZOS).save(icons/name)
image.save(icons/'icon.ico',sizes=[(16,16),(32,32),(48,48),(64,64),(128,128),(256,256)])
image.save(icons/'icon.icns')
image.resize((256,256),Image.Resampling.LANCZOS).save(root/'app/assets/logo.png')
print('Transparent PNG, ICO, and ICNS derivatives regenerated.')
