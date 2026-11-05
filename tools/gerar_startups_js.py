# Gera startups.js a partir da pasta startups/.
# Uso: python3 tools/gerar_startups_js.py
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "startups"

DEVICES = [
    ("stm32f411ce", "STM32F411CEU6", "startup_stm32f411xe", "ST CMSIS · cmsis-device-f4"),
    ("stm32f103c8", "STM32F103C8T6", "startup_stm32f103xb", "ST CMSIS · cmsis-device-f1"),
    ("stm32f407vg", "STM32F407VGT6", "startup_stm32f407xx", "ST CMSIS · cmsis-device-f4"),
    ("tm4c123gh6pm", "TM4C123GH6PM", "startup_tm4c123gh6pm", "TivaWare 2.2.0.295 · hw_ints.h"),
    ("tm4c1294ncpdt", "TM4C1294NCPDT", "startup_tm4c1294ncpdt", "TivaWare 2.2.0.295 · hw_ints.h"),
]
LICENSES = ["LICENSE-ST-cmsis-device-f4.md", "LICENSE-ST-cmsis-device-f1.md"]


def count_gnu(text):
    lines = text.splitlines()
    start = next(i for i, l in enumerate(lines) if re.match(r"\s*g_pfnVectors:", l))
    n = 0
    for l in lines[start + 1:]:
        code = l.split("@")[0].split("/*")[0]
        if re.search(r"\.size\s+g_pfnVectors", code):
            break
        if re.match(r"\s*\.word\b", code):
            n += 1
    return n


def count_keil(text):
    lines = text.splitlines()
    start = next(i for i, l in enumerate(lines) if re.match(r"__Vectors\s", l))
    n = 0
    for l in lines[start:]:
        code = l.split(";")[0]
        if code.startswith("__Vectors_End"):
            break
        if re.search(r"\bDCD\b", code):
            n += 1
    return n


def read(path):
    text = path.read_text(encoding="utf-8")
    return text.replace("\r\n", "\n")


data = {}
for dev_id, device, base, origin in DEVICES:
    gnu = read(SRC / f"{base}.s")
    keil = read(SRC / f"{base}_keil.s")
    data[dev_id] = {
        "device": device,
        "origin": origin,
        "gnu": {"name": f"{base}.s", "vectors": count_gnu(gnu), "source": gnu},
        "keil": {"name": f"{base}_keil.s", "vectors": count_keil(keil), "source": keil},
    }
    print(f"{device:15} GNU {data[dev_id]['gnu']['vectors']:4} vetores · Keil {data[dev_id]['keil']['vectors']:4} vetores")

licenses = [{"name": n, "source": read(SRC / n)} for n in LICENSES]

js = (
    "/* Gerado por tools/gerar_startups_js.py a partir de startups/. Não edite à mão. */\n"
    "(function (root) {\n"
    '  "use strict";\n'
    f"  root.LabStartups = {json.dumps(data, ensure_ascii=False, indent=1)};\n"
    f"  root.LabStartupLicenses = {json.dumps(licenses, ensure_ascii=False)};\n"
    '})(typeof globalThis !== "undefined" ? globalThis : window);\n'
)
(ROOT / "startups.js").write_text(js, encoding="utf-8")
print("startups.js:", len(js.encode()), "bytes")
