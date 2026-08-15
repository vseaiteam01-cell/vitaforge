# -*- coding: utf-8 -*-
"""Качает диптихи упражнений с Higgsfield, режет пополам на кадры старт/конец.

Вход:  ex_urls.json  {"<key>": "<url диптиха>", ...}
Выход: assets/ex/<key>_0.jpg  (левая половина — стартовая фаза)
       assets/ex/<key>_1.jpg  (правая половина — конечная фаза)
"""
import io, json, os, sys, urllib.request

ROOT = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(ROOT, 'assets', 'ex')
RAW = os.path.join(ROOT, 'assets', 'ex', '_raw')
PROXY = os.environ.get('HF_PROXY', 'http://127.0.0.1:10809')

from PIL import Image


def fetch(url, use_proxy):
    if use_proxy:
        op = urllib.request.build_opener(
            urllib.request.ProxyHandler({'http': PROXY, 'https': PROXY}))
    else:
        op = urllib.request.build_opener(urllib.request.ProxyHandler({}))
    op.addheaders = [('User-Agent', 'Mozilla/5.0')]
    return op.open(url, timeout=90).read()


def main():
    os.makedirs(OUT, exist_ok=True)
    os.makedirs(RAW, exist_ok=True)
    urls = json.load(open(os.path.join(ROOT, 'ex_urls.json'), encoding='utf-8'))

    ok, fail = [], []
    for key, url in urls.items():
        left = os.path.join(OUT, key + '_0.jpg')
        right = os.path.join(OUT, key + '_1.jpg')
        if os.path.exists(left) and os.path.exists(right):
            ok.append((key, 'уже скачан'))
            continue
        data = None
        # сначала локальный прокси: прямые запросы перехватывает Proxifier и они виснут
        for use_proxy in (True, False):
            try:
                data = fetch(url, use_proxy)
                break
            except Exception as e:
                err = '%s (proxy=%s)' % (e, use_proxy)
        if not data:
            fail.append((key, err))
            continue

        open(os.path.join(RAW, key + '.png'), 'wb').write(data)
        im = Image.open(io.BytesIO(data)).convert('RGB')
        w, h = im.size
        mid = w // 2
        # режем пополам, отступив 4 px от шва, чтобы разделитель не попал в кадр
        im.crop((0, 0, mid - 4, h)).save(left, quality=90)
        im.crop((mid + 4, 0, w, h)).save(right, quality=90)
        ok.append((key, '%dx%d -> 2 x %dx%d' % (w, h, mid - 4, h)))

    print('=' * 60)
    for k, v in ok:
        print('OK   %-16s %s' % (k, v))
    for k, v in fail:
        print('FAIL %-16s %s' % (k, v))
    print('=' * 60)
    print('скачано и нарезано: %d из %d' % (len(ok), len(urls)))
    print('кадров на диске: %d' % len([f for f in os.listdir(OUT) if f.endswith('.jpg')]))
    if fail:
        sys.exit(1)


if __name__ == '__main__':
    main()
