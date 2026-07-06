#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
build_catalog.py  (DATA/DB repo)
อ่าน data.json (จากไปป์ไลน์ราคา Mercari/Shopee) -> สร้าง catalog.json ให้หน้าร้าน (FE) ดึงราคาสด
- ราคาที่แสดงลูกค้า = "ราคาขายเอง" (self-sell) คำนวณจากต้นทุน jp (เยน) ถ้ามี, ไม่มีก็ fallback ราคา Shopee
"""
import json, math, os, re, sys

HERE = os.path.dirname(os.path.abspath(__file__))
SRC  = os.environ.get("DATA_JSON", os.path.join(HERE, "data.json"))
OUT  = os.environ.get("CATALOG_OUT", os.path.join(HERE, "catalog.json"))

MARKUP = 30      # %
VAT    = 7       # %
SHIP   = 200     # ค่าส่งญี่ปุ่น->ไทย ต่อชิ้น (บาท)

def round90(n):
    return math.ceil(n/100)*100 - 10

def sell_from_jp(jp, rate):
    if not jp: return None
    return round90((jp*rate + SHIP) * (1 + MARKUP/100) / (1 - VAT/100))

# ---- ตัวช่วยจัดหมวด/ซีรีส์ (heuristic จากชื่อ+คีย์เวิร์ด) ----
def classify_category(name):
    s = name.lower()
    if any(k in s for k in ["pokémon","pokemon","โปเกม่อน","โปเกมอน","การ์ดเกม","card game","booster","tcg","ซอง","กล่องบูสเตอร์"]):
        return "pokemon"
    return "kuji"

SERIES = [
 ("One Piece", ["one piece","วันพีช","วันพีซ","luffy","ลูฟี่","โซโร","zoro","แชงค์"]),
 ("Naruto", ["naruto","นารูโตะ","sasuke","ซาสึเกะ","akatsuki","แสงอุษา","kakashi","คาคาชิ","hokage"]),
 ("Dragon Ball", ["dragon ball","ดราก้อนบอล","goku","โกคู","daima","ไดมะ","saiyan","ไซย่า"]),
 ("Demon Slayer", ["demon slayer","ดาบพิฆาต","kimetsu","tanjiro","ทันจิโร"]),
 ("Jujutsu Kaisen", ["jujutsu","มหาเวทย์ผนึกมาร","gojo","โกโจ","sukuna","ซุคุนะ"]),
 ("My Hero Academia", ["my hero","มายฮีโร่","boku no hero","academia","deku","เดกุ","kingdom the animation"]),
 ("Hunter x Hunter", ["hunter","ฮันเตอร์","killua","คิรัว","chimera"]),
 ("Bleach", ["bleach","บลีช","เทพมรณะ"]),
 ("JoJo", ["jojo","โจโจ้"]),
 ("Gundam", ["gundam","กันดั้ม","gquuu","gquuuuuuX".lower()]),
 ("Pokemon", ["pokémon","pokemon","โปเกม่อน","โปเกมอน"]),
 ("Attack on Titan", ["attack on titan","ผ่าพิภพไททัน","titan","ไททัน"]),
 ("Blue Lock", ["blue lock","บลูล็อค","คุกฟ้า"]),
 ("Chainsaw Man", ["chainsaw","เลื่อยยนต์"]),
 ("Sakamoto Days", ["sakamoto","ซากาโมโตะ"]),
 ("Kaiju No. 8", ["kaiju","ไคจู"]),
 ("Uma Musume", ["uma musume","อุมะ","สาวม้า"]),
 ("Quintessential Quintuplets", ["quintuplets","แฝดห้า","quintessential"]),
 ("Evangelion", ["evangelion","อีวา"]),
 ("Yu Yu Hakusho", ["yu yu hakusho","yuyu","ยูยู่"]),
 ("Godzilla", ["godzilla","ก็อดซิลล่า","ก็อตซิลล่า"]),
 ("NIKKE", ["nikke","นิเคะ"]),
 ("Slime", ["slime","สไลม์","rimuru","ริมุรุ"]),
 ("Haikyu", ["haikyu","ไฮคิว"]),
 ("iDOLM@STER", ["idolmaster","idolm","ไอดอลมาสเตอร์","ไอดอล มาสเตอร์"]),
 ("Dandadan", ["dandadan","ดาดาดัน"]),
 ("Kingdom", ["kingdom","คิงดอม"]),
 ("Kamen Rider", ["kamen rider","คาเมน","มาสค์ไรเดอร์"]),
 ("Hololive", ["hololive","โฮโลไลฟ์"]),
 ("Reborn", ["reborn","รีบอร์น"]),
 ("Gintama", ["gintama","กินทามะ"]),
 ("WIND BREAKER", ["wind breaker","วินเบรค"]),
 ("Frieren", ["frieren"]),
 ("Death Note", ["death note","เดธโน"]),
 ("Tom and Jerry", ["tom and jerry","ทอมแอนด์เจอร์รี่","ทอม"]),
 ("Fate", ["fate","berserk","เบอร์เซิก","guts","กัทส์"]),
 ("Crayon Shinchan", ["shin-chan","shinchan","ชินจัง"]),
]
def classify_series(name, kw):
    s = (name + " " + (kw or "")).lower()
    for label, keys in SERIES:
        if any(k in s for k in keys):
            return label
    return "อื่นๆ"

def main():
    os.makedirs(os.path.join(HERE,"public"),exist_ok=True)
    d = json.load(open(SRC, encoding="utf-8"))
    rate = d.get("rate", 0.2043)
    cols = d.get("collections", [])
    out = []
    for c in cols:
        prizes = c.get("prizes") or []
        name = c.get("name","")
        variations, imgs, sells = [], [], []
        for pz in prizes:
            jp = pz.get("jp")
            shopee = pz.get("shopee")
            sell = sell_from_jp(jp, rate) or (round90(shopee) if shopee else None)
            if sell: sells.append(sell)
            img = pz.get("img") or c.get("cover") or ""
            if img and img not in imgs: imgs.append(img)
            variations.append({
                "label": str(pz.get("pz","")),
                "opt": "",
                "price": sell or 0,
                "stock": 5,
                "img": img,
            })
        if not sells:
            continue
        price, priceMax = min(sells), max(sells)
        status = "preorder" if ("พรีออเดอร์" in name or "พรีออเดอร" in name) else "instock"
        cover = c.get("cover") or (imgs[0] if imgs else "")
        out.append({
            "id": "sp-" + str(c.get("id","")),
            "name": name,
            "category": classify_category(name),
            "series": classify_series(name, c.get("jpkw")),
            "price": price,
            "priceMax": priceMax,
            "status": status,
            "stock": sum(1 for v in variations if v["stock"]>0)*5,
            "img": cover,
            "images": ([cover] + [i for i in imgs if i != cover])[:14],
            "addedAt": c.get("addedDate") or "",
            "desc": name,
            "variations": variations,
        })
    meta = {"updated": d.get("updated"), "rate": rate, "markup": MARKUP, "vat": VAT, "ship": SHIP, "count": len(out)}
    json.dump({"meta": meta, "products": out}, open(OUT,"w",encoding="utf-8"), ensure_ascii=False, indent=1)
    print(f"[ok] catalog.json: {len(out)} products -> {OUT}")
    # สรุปหมวด/ซีรีส์
    from collections import Counter
    print(" category:", dict(Counter(p['category'] for p in out)))
    top = Counter(p['series'] for p in out).most_common(8)
    print(" top series:", top)

if __name__ == "__main__":
    main()
