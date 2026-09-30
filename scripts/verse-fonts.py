# Subsets the four headline fonts to the characters in site/home.js, so each ships as a small woff2.
# Run again after editing the couplets: python scripts/verse-fonts.py <folder with the source fonts>
# Needs fonttools and brotli. Subsets are renamed, since OFL reserves the original names for unmodified fonts.
import pathlib, sys
from fontTools import subset
from fontTools.ttLib import TTFont

FONTS = {  # output name: (source file, family name inside the subset)
    'verse-song': ('NotoSerifSC.ttf', 'Verse Song'),
    'verse-kai': ('LXGWWenKai.ttf', 'Verse Kai'),
    'verse-wei': ('ZCOOLXiaoWei.ttf', 'Verse Wei'),
    'verse-hei': ('SmileySans-Oblique.ttf', 'Verse Hei'),
}
root = pathlib.Path(__file__).resolve().parent.parent
source = pathlib.Path(sys.argv[1])
out = root / 'site' / 'assets' / 'fonts'
text = ''.join(sorted({c for c in (root / 'site' / 'home.js').read_text(encoding='utf-8') if ord(c) > 127} | set('零一二三四五六七八九十百')))

for name, (file, family) in FONTS.items():
    font = TTFont(source / file)
    options = subset.Options()
    options.flavor = 'woff2'
    options.layout_features = ['*']
    subsetter = subset.Subsetter(options)
    subsetter.populate(text=text)
    subsetter.subset(font)
    for record in font['name'].names:
        if record.nameID in (1, 3, 4, 6, 16, 21):
            record.string = family.replace(' ', '') if record.nameID == 6 else family
    font.flavor = 'woff2'
    font.save(out / f'{name}.woff2')
    print(f'{name}.woff2  {(out / f"{name}.woff2").stat().st_size // 1024} KB')
print(f'{len(text)} characters')
