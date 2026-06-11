from reportlab.lib.pagesizes import A4
from reportlab.pdfgen import canvas
from reportlab.lib import colors
from reportlab.lib.units import mm, cm
from reportlab.platypus import Paragraph
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_JUSTIFY
import math
import random
import os

# Square page size: 210mm x 210mm
PAGE = (210*mm, 210*mm)
W, H = PAGE

# Brand colours
BURGUNDY     = colors.HexColor('#7d1a1a')
DARK_BURGUNDY= colors.HexColor('#5a0f0f')
LIGHT_BURG   = colors.HexColor('#a83232')
CREAM        = colors.HexColor('#faf6f0')
IVORY        = colors.HexColor('#f5ede0')
GOLD         = colors.HexColor('#c9a96e')
GOLD_LIGHT   = colors.HexColor('#e8d5a3')
CHARCOAL     = colors.HexColor('#2c2c2c')
GREY         = colors.HexColor('#888888')
LIGHT_GREY   = colors.HexColor('#e8e0d8')
WHITE        = colors.white

OUTPUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'Bodilicious_Catalogue_2025.pdf')

c = canvas.Canvas(OUTPUT, pagesize=PAGE)
c.setTitle("Bodilicious - Premium Herbal Skincare & Haircare Catalogue 2025")

# ─── HELPERS ────────────────────────────────────────────────────────────────

def bg(col=CREAM):
    c.setFillColor(col)
    c.rect(0, 0, W, H, fill=1, stroke=0)

def para(text, x, y, w, style, col=CHARCOAL, size=9, leading=13, align=TA_LEFT):
    ps = ParagraphStyle('p_style', fontName=style, fontSize=size, leading=leading,
                        textColor=col, alignment=align)
    p = Paragraph(text, ps)
    p.wrapOn(c, w, 9999)
    p.drawOn(c, x, y - p.height)
    return p.height

def divider(y, col=GOLD, lw=0.5):
    c.setStrokeColor(col)
    c.setLineWidth(lw)
    c.line(16*mm, y, W-16*mm, y)

def brand_stripe(y, h=1.2*mm, col=BURGUNDY):
    c.setFillColor(col)
    c.rect(0, y, W, h, fill=1, stroke=0)

def gold_box(x, y, w, h, radius=4):
    c.setStrokeColor(GOLD)
    c.setLineWidth(0.8)
    c.setFillColor(colors.transparent)
    c.roundRect(x, y, w, h, radius, fill=0, stroke=1)

def filled_box(x, y, w, h, col, radius=4):
    c.setFillColor(col)
    c.roundRect(x, y, w, h, radius, fill=1, stroke=0)

def burg_badge(cx, cy, r=10*mm, text='', subtext=''):
    c.setFillColor(BURGUNDY)
    c.circle(cx, cy, r, fill=1, stroke=0)
    c.setFillColor(WHITE)
    c.setFont('Helvetica-Bold', 7)
    c.drawCentredString(cx, cy+1*mm, text)
    c.setFont('Helvetica', 5.5)
    c.drawCentredString(cx, cy-3*mm, subtext)

def icon_circle(cx, cy, r, label, label2=''):
    c.setFillColor(IVORY)
    c.setStrokeColor(GOLD)
    c.setLineWidth(0.8)
    c.circle(cx, cy, r, fill=1, stroke=1)
    c.setFillColor(CHARCOAL)
    c.setFont('Helvetica-Bold', 6.5)
    c.drawCentredString(cx, cy-r-5*mm, label)
    if label2:
        c.setFont('Helvetica', 6)
        c.drawCentredString(cx, cy-r-9*mm, label2)

def draw_logo(cx, cy, size=24*mm):
    """Draw stylised BODILICIOUS logo wordmark"""
    c.setStrokeColor(GOLD)
    c.setLineWidth(1.2)
    c.setFillColor(colors.transparent)
    c.circle(cx, cy+size*0.15, size*0.55, fill=0, stroke=1)
    c.setLineWidth(0.5)
    c.circle(cx, cy+size*0.15, size*0.52, fill=0, stroke=1)
    c.setFillColor(BURGUNDY)
    c.setFont('Helvetica-Bold', size*0.32)
    c.drawCentredString(cx, cy+size*0.08, 'BODILICIOUS')
    c.setFont('Helvetica', size*0.14)
    c.setFillColor(GOLD)
    c.drawCentredString(cx, cy-size*0.08, 'NATURAL PRODUCTS')
    for angle in [30, 150, 210, 330]:
        rad = math.radians(angle)
        lx = cx + math.cos(rad)*size*0.48
        ly = cy + size*0.15 + math.sin(rad)*size*0.48
        c.setFillColor(GOLD)
        c.circle(lx, ly, 1.5, fill=1, stroke=0)

def draw_serum_bottle(cx, cy, w=18*mm, h=38*mm, label='SERUM', col=BURGUNDY):
    """Draw a stylised skincare bottle"""
    c.setFillColor(GOLD)
    c.roundRect(cx-w*0.2, cy+h*0.82, w*0.4, h*0.22, 2, fill=1, stroke=0)
    c.setFillColor(IVORY)
    c.rect(cx-w*0.12, cy+h*0.75, w*0.24, h*0.1, fill=1, stroke=0)
    c.setFillColor(CREAM)
    c.setStrokeColor(GOLD)
    c.setLineWidth(0.8)
    c.roundRect(cx-w*0.5, cy, w, h*0.8, 4, fill=1, stroke=1)
    c.setFillColor(col)
    c.roundRect(cx-w*0.45, cy+h*0.15, w*0.9, h*0.45, 3, fill=1, stroke=0)
    c.setFillColor(WHITE)
    c.setFont('Helvetica-Bold', 5.5)
    c.drawCentredString(cx, cy+h*0.4, label[:8])
    c.setFont('Helvetica', 4.5)
    c.drawCentredString(cx, cy+h*0.3, '30 ML')
    c.setStrokeColor(GOLD)
    c.setLineWidth(0.3)
    c.line(cx-w*0.38, cy+h*0.07, cx+w*0.38, cy+h*0.07)

def star_rating(cx, cy, rating=4.5, star_size=4):
    full = int(rating)
    half = (rating - full) >= 0.5
    for i in range(5):
        sx = cx + (i - 2) * (star_size*2+2)
        if i < full:
            c.setFillColor(GOLD)
        elif i == full and half:
            c.setFillColor(GOLD_LIGHT)
        else:
            c.setFillColor(LIGHT_GREY)
        pts = []
        for j in range(10):
            ang = math.radians(j*36 - 90)
            r = star_size if j % 2 == 0 else star_size*0.45
            pts.append(sx + r*math.cos(ang))
            pts.append(cy + r*math.sin(ang))
        path = c.beginPath()
        path.moveTo(pts[0], pts[1])
        for j in range(2, len(pts), 2):
            path.lineTo(pts[j], pts[j+1])
        path.close()
        c.drawPath(path, fill=1, stroke=0)

def tick(x, y, label, col=BURGUNDY):
    c.setFillColor(col)
    c.setFont('Helvetica-Bold', 9)
    c.drawString(x, y, '*')
    c.setFillColor(CHARCOAL)
    c.setFont('Helvetica', 8)
    c.drawString(x+6*mm, y, label)

def section_header(title, subtitle='', y=None, col=BURGUNDY):
    if y is None:
        return
    c.setFillColor(col)
    c.setFont('Helvetica-Bold', 16)
    c.drawCentredString(W/2, y, title)
    if subtitle:
        c.setFillColor(GREY)
        c.setFont('Helvetica', 8)
        c.drawCentredString(W/2, y-7*mm, subtitle)
    c.setFillColor(GOLD)
    bar_w = 20*mm
    c.rect(W/2-bar_w/2, y-9.5*mm, bar_w, 0.8*mm, fill=1, stroke=0)

# ─── CONTACT ICON HELPER (replaces emoji) ────────────────────────────────────
def draw_contact_icon(cx, cy, r, icon_type):
    """Draw a simple icon in a circle - replaces emoji"""
    c.setFillColor(BURGUNDY)
    c.circle(cx, cy, r, fill=1, stroke=0)
    c.setStrokeColor(GOLD)
    c.setLineWidth(0.6)
    c.circle(cx, cy, r, fill=0, stroke=1)
    c.setFillColor(WHITE)
    c.setFont('Helvetica-Bold', 7)
    labels = {
        'web': 'WEB', 'insta': 'IG', 'email': 'MAIL',
        'ship': 'FREE', 'factory': 'MFG', 'star': '*'
    }
    c.drawCentredString(cx, cy - 2, labels.get(icon_type, '?'))

# ═══════════════════════════════════════════════════════════
# PAGE 1 — COVER
# ═══════════════════════════════════════════════════════════
bg(CREAM)

c.setFillColor(BURGUNDY)
c.rect(0, H-20*mm, W, 20*mm, fill=1, stroke=0)
c.setFillColor(GOLD)
c.rect(0, H-21*mm, W, 1.5*mm, fill=1, stroke=0)

c.setFillColor(BURGUNDY)
c.rect(0, 0, W, 18*mm, fill=1, stroke=0)
c.setFillColor(GOLD)
c.rect(0, 18*mm, W, 1.5*mm, fill=1, stroke=0)

c.setFillColor(GOLD)
c.setFont('Helvetica', 7)
c.drawCentredString(W/2, H-13*mm, 'PREMIUM HERBAL SKINCARE & HAIRCARE')

c.setFillColor(colors.HexColor('#f0e8de'))
c.circle(W*0.15, H*0.6, 35*mm, fill=1, stroke=0)
c.circle(W*0.85, H*0.35, 28*mm, fill=1, stroke=0)
c.circle(W*0.5, H*0.18, 20*mm, fill=1, stroke=0)

c.setStrokeColor(GOLD)
c.setLineWidth(0.5)
c.line(30*mm, H-30*mm, 30*mm, 30*mm)
c.line(W-30*mm, H-30*mm, W-30*mm, 30*mm)

draw_logo(W/2, H*0.62, size=32*mm)

for dx in [-35*mm, 35*mm]:
    c.setFillColor(GOLD)
    cx2 = W/2+dx
    cy2 = H*0.62+14*mm
    pts = [cx2, cy2+4, cx2+4, cy2, cx2, cy2-4, cx2-4, cy2]
    path = c.beginPath()
    path.moveTo(pts[0], pts[1])
    for i in range(2, len(pts), 2):
        path.lineTo(pts[i], pts[i+1])
    path.close()
    c.drawPath(path, fill=1, stroke=0)

c.setFillColor(CHARCOAL)
c.setFont('Helvetica', 10)
c.drawCentredString(W/2, H*0.44, 'Science-Backed  .  Herbal-Powered  .  India-Proud')

divider(H*0.41, GOLD, 0.8)

c.setFillColor(BURGUNDY)
c.setFont('Helvetica-Bold', 13)
c.drawCentredString(W/2, H*0.37, 'PRODUCT CATALOGUE 2025')

bottle_positions = [W/2-40*mm, W/2-13*mm, W/2+14*mm, W/2+40*mm]
labels_b = ['SERUMS', 'CLEANSERS', 'SUNCARE', 'HAIRCARE']
cols_b   = [BURGUNDY, DARK_BURGUNDY, LIGHT_BURG, BURGUNDY]
for bx, bl, bc in zip(bottle_positions, labels_b, cols_b):
    draw_serum_bottle(bx, H*0.21, w=14*mm, h=26*mm, label=bl, col=bc)

c.setFillColor(GOLD)
c.setFont('Helvetica', 7)
c.drawCentredString(W/2, 10*mm, 'www.bodilicious.in  |  @bodilicious.in  |  Made in India')

c.showPage()

# ═══════════════════════════════════════════════════════════
# PAGE 2 — BRAND STORY
# ═══════════════════════════════════════════════════════════
bg(IVORY)

c.setFillColor(BURGUNDY)
c.rect(0, 0, 8*mm, H, fill=1, stroke=0)
c.setFillColor(GOLD)
c.rect(8*mm, 0, 1.5*mm, H, fill=1, stroke=0)

c.setFillColor(BURGUNDY)
c.setFont('Helvetica-Bold', 20)
c.drawString(20*mm, H-25*mm, 'Our Story')
c.setFillColor(GOLD)
c.rect(20*mm, H-27.5*mm, 25*mm, 1.2*mm, fill=1, stroke=0)
c.setFillColor(GREY)
c.setFont('Helvetica', 8)
c.drawString(20*mm, H-32*mm, 'WHERE NATURE MEETS SCIENCE')

cx_p = W-32*mm
cy_p = H-52*mm
r_p = 22*mm
c.setFillColor(colors.HexColor('#e8d5c0'))
c.circle(cx_p, cy_p, r_p, fill=1, stroke=0)
c.setStrokeColor(GOLD)
c.setLineWidth(1.2)
c.circle(cx_p, cy_p, r_p, fill=0, stroke=1)
c.setStrokeColor(GOLD)
c.setLineWidth(0.4)
c.circle(cx_p, cy_p, r_p+2*mm, fill=0, stroke=1)
c.setFillColor(BURGUNDY)
c.setFont('Helvetica', 7)
c.drawCentredString(cx_p, cy_p-1*mm, 'FOUNDER &')
c.drawCentredString(cx_p, cy_p-5*mm, 'FORMULATOR')

story_text = [
    ("Why Bodilicious Exists", True),
    ("Bodilicious was born from a deeply personal need — the frustration of navigating an overwhelming skincare "
     "market filled with chemical-heavy products that promise much but deliver little. Our founder, rooted in "
     "Chennai's rich tradition of herbal wisdom, set out to create formulations that actually work for Indian skin.", False),
    ("", False),
    ("Our Philosophy", True),
    ("We believe that what goes on your skin matters as much as what goes in your body. Every Bodilicious product "
     "is crafted at the intersection of ancient herbal knowledge and modern clinical science — giving you the "
     "best of both worlds, without compromise.", False),
    ("", False),
    ("What Makes Us Different", True),
    ("Unlike mass-market brands, we own our manufacturing process from ingredient sourcing to final packaging. "
     "This means complete quality control, no outsourcing, and formulations designed specifically for the Indian "
     "climate — humid summers, harsh winters, and everything in between. Every batch is tested before it reaches you.", False),
    ("", False),
    ("Ingredient-First. Always.", True),
    ("We start with the ingredient, not the trend. Niacinamide, Retinol, Hyaluronic Acid, Centella Asiatica — "
     "chosen because science says they work, not because they're fashionable. No fillers. No false promises.", False),
]

y_text = H - 42*mm
text_w = W - 55*mm
for line, is_heading in story_text:
    if not line:
        y_text -= 4*mm
        continue
    if is_heading:
        c.setFillColor(BURGUNDY)
        c.setFont('Helvetica-Bold', 9.5)
        c.drawString(20*mm, y_text, line)
        y_text -= 5.5*mm
    else:
        h_used = para(line, 20*mm, y_text, text_w, 'Helvetica', CHARCOAL, 8.5, 13, TA_JUSTIFY)
        y_text -= h_used + 2*mm

q_y = 35*mm
c.setFillColor(colors.HexColor('#f0e4d4'))
c.roundRect(16*mm, q_y-2*mm, W-32*mm, 22*mm, 6, fill=1, stroke=0)
c.setStrokeColor(GOLD)
c.setLineWidth(0.8)
c.roundRect(16*mm, q_y-2*mm, W-32*mm, 22*mm, 6, fill=0, stroke=1)
c.setFillColor(BURGUNDY)
c.setFont('Helvetica-Bold', 22)
c.drawString(20*mm, q_y+16*mm, '"')
c.setFillColor(DARK_BURGUNDY)
c.setFont('Helvetica', 9)
c.drawCentredString(W/2, q_y+10*mm, 'Your skin deserves ingredients you can trust,')
c.drawCentredString(W/2, q_y+5*mm, 'formulated with love, science, and integrity.')
c.setFillColor(BURGUNDY)
c.setFont('Helvetica-Bold', 8)
c.drawCentredString(W/2, q_y, '- Founder, Bodilicious Natural Products')

c.setFillColor(BURGUNDY)
c.rect(0, 0, W, 8*mm, fill=1, stroke=0)
c.setFillColor(GOLD)
c.setFont('Helvetica', 7)
c.drawCentredString(W/2, 2.5*mm, '02')

c.showPage()

# ═══════════════════════════════════════════════════════════
# PAGE 3 — BRAND VALUES
# ═══════════════════════════════════════════════════════════
bg(CREAM)

c.setFillColor(BURGUNDY)
c.rect(0, H-16*mm, W, 16*mm, fill=1, stroke=0)
c.setFillColor(GOLD)
c.setFont('Helvetica-Bold', 10)
c.drawCentredString(W/2, H-10*mm, 'OUR BRAND PROMISE')
c.setFillColor(GOLD)
c.rect(0, H-17.5*mm, W, 1.5*mm, fill=1, stroke=0)

section_header('What We Stand For', 'Every product. Every batch. Every time.', y=H-32*mm)

# 6 value icons in 3x2 grid — use text labels instead of emoji
values = [
    ('SULPHATE', 'FREE'),
    ('PARABEN', 'FREE'),
    ('CRUELTY', 'FREE'),
    ('DERM.', 'TESTED'),
    ('CLIMATE', 'ADAPTED'),
    ('NO SYNTH.', 'FRAGRANCE'),
]
value_subtitles = [
    'Sulphate Free', 'Paraben Free', 'Cruelty Free',
    'Derm. Tested', 'Indian Climate Adapted', 'No Synthetic Fragrance'
]

cols_grid = 3
cell_w = (W - 32*mm) / cols_grid
cell_h = 38*mm
start_x = 16*mm + cell_w/2
start_y = H - 80*mm

for i, ((line1, line2), subtitle) in enumerate(zip(values, value_subtitles)):
    row = i // cols_grid
    col = i % cols_grid
    cx_v = start_x + col * cell_w
    cy_v = start_y - row * (cell_h + 5*mm)

    c.setFillColor(IVORY)
    c.setStrokeColor(GOLD)
    c.setLineWidth(0.7)
    c.roundRect(cx_v-cell_w*0.42, cy_v-cell_h*0.5, cell_w*0.84, cell_h, 8, fill=1, stroke=1)

    # Draw decorative circle instead of emoji
    c.setFillColor(colors.HexColor('#f0e4d4'))
    c.setStrokeColor(BURGUNDY)
    c.setLineWidth(0.6)
    c.circle(cx_v, cy_v+8*mm, 7*mm, fill=1, stroke=1)
    c.setFillColor(BURGUNDY)
    c.setFont('Helvetica-Bold', 6)
    c.drawCentredString(cx_v, cy_v+9.5*mm, line1)
    c.drawCentredString(cx_v, cy_v+6.5*mm, line2)

    c.setFillColor(BURGUNDY)
    c.setFont('Helvetica-Bold', 8.5)
    c.drawCentredString(cx_v, cy_v-2*mm, line1)
    c.setFillColor(CHARCOAL)
    c.setFont('Helvetica', 7.5)
    c.drawCentredString(cx_v, cy_v-6.5*mm, line2)

    c.setFillColor(GOLD)
    c.circle(cx_v+cell_w*0.33, cy_v+cell_h*0.42, 3.5*mm, fill=1, stroke=0)
    c.setFillColor(WHITE)
    c.setFont('Helvetica-Bold', 7)
    c.drawCentredString(cx_v+cell_w*0.33, cy_v+cell_h*0.4, 'OK')

strip_y = 18*mm
c.setFillColor(BURGUNDY)
c.roundRect(16*mm, strip_y, W-32*mm, 16*mm, 6, fill=1, stroke=0)
c.setFillColor(GOLD)
c.setFont('Helvetica-Bold', 8)
c.drawCentredString(W/2, strip_y+10*mm, 'Free from harmful chemicals  .  Dermatologically Inspired  .  Made in India')
c.setFillColor(WHITE)
c.setFont('Helvetica', 7)
c.drawCentredString(W/2, strip_y+5*mm, 'All products are tested for safety and efficacy before reaching your skin')

c.setFillColor(BURGUNDY)
c.rect(0, 0, W, 8*mm, fill=1, stroke=0)
c.setFillColor(GOLD)
c.setFont('Helvetica', 7)
c.drawCentredString(W/2, 2.5*mm, '03')
c.showPage()

# ═══════════════════════════════════════════════════════════
# PAGE 4 — PRODUCT CATEGORIES OVERVIEW
# ═══════════════════════════════════════════════════════════
bg(IVORY)

c.setFillColor(BURGUNDY)
c.rect(0, H-16*mm, W, 16*mm, fill=1, stroke=0)
c.setFillColor(GOLD)
c.setFont('Helvetica-Bold', 10)
c.drawCentredString(W/2, H-10*mm, 'OUR COLLECTIONS')
c.setFillColor(GOLD)
c.rect(0, H-17.5*mm, W, 1.5*mm, fill=1, stroke=0)

section_header('Explore Our Range', 'Crafted for every skin & hair need', y=H-32*mm)

categories = [
    ('FACE SERUMS', 'Vitamin C  .  Niacinamide\nRetinol  .  Hyaluronic Acid\nCoQ10  .  AHA/BHA'),
    ('CLEANSERS', 'Brightening Face Wash\nRose Body Wash\nOlive Oil Soap  .  Goat Milk Soap'),
    ('SUNSCREEN', 'Liquid SPF 50+\nPhysical SPF 50\nNiacinamide SPF 30 Serum'),
    ('MOISTURISERS', 'Oats Protein Moisturiser\nSaf Gel  .  Collagen Cream\nNight Repair Cream'),
    ('HAIRCARE', 'Milk Protein Shampoo\nKeratin Conditioner\nHerbal Hair Oil  .  Shikakai'),
    ('BODYCARE', 'Beetroot Lip Balm\nOlive Soap  .  Rose Body Wash\nUnderarm Lightening'),
]

cell_w2 = (W - 32*mm) / 3
cell_h2 = 38*mm
sx2 = 16*mm + cell_w2/2
sy2 = H - 72*mm

for i, (cat, products) in enumerate(categories):
    row = i // 3
    col = i % 3
    cx_c = sx2 + col * cell_w2
    cy_c = sy2 - row * (cell_h2 + 6*mm)

    c.setFillColor(CREAM)
    c.setStrokeColor(BURGUNDY)
    c.setLineWidth(0.6)
    c.roundRect(cx_c-cell_w2*0.44, cy_c-cell_h2*0.55, cell_w2*0.88, cell_h2, 6, fill=1, stroke=1)

    c.setFillColor(BURGUNDY)
    c.roundRect(cx_c-cell_w2*0.44, cy_c+cell_h2*0.24, cell_w2*0.88, 10*mm, 6, fill=1, stroke=0)
    c.setFillColor(GOLD)
    c.setFont('Helvetica-Bold', 7.5)
    c.drawCentredString(cx_c, cy_c+cell_h2*0.32, cat)

    c.setFillColor(CHARCOAL)
    c.setFont('Helvetica', 6.8)
    lines = products.split('\n')
    for j, line in enumerate(lines):
        c.drawCentredString(cx_c, cy_c+cell_h2*0.1 - j*5.5*mm, line)

c.setFillColor(BURGUNDY)
c.rect(0, 0, W, 18*mm, fill=1, stroke=0)
c.setFillColor(GOLD)
c.rect(0, 18*mm, W, 1.5*mm, fill=1, stroke=0)
c.setFillColor(WHITE)
c.setFont('Helvetica-Bold', 9)
c.drawCentredString(W/2, 11*mm, '100+ Products Across 6 Categories')
c.setFillColor(GOLD)
c.setFont('Helvetica', 7)
c.drawCentredString(W/2, 5*mm, 'www.bodilicious.in  .  Free shipping on orders above Rs.1500')

c.showPage()

# ═══════════════════════════════════════════════════════════
# PAGE 5 — HERO PRODUCT: NIACINAMIDE SERUM
# ═══════════════════════════════════════════════════════════
bg(CREAM)

c.setFillColor(colors.HexColor('#f7f0e6'))
c.rect(0, 0, W/2, H, fill=1, stroke=0)

c.setFillColor(BURGUNDY)
c.rect(0, H-12*mm, W, 12*mm, fill=1, stroke=0)
c.setFillColor(GOLD)
c.setFont('Helvetica', 7)
c.drawCentredString(W/2, H-7.5*mm, "HERO PRODUCT  .  BESTSELLER  .  EDITOR'S PICK")

bx_c = W*0.27
by_c = H*0.5
c.setFillColor(colors.HexColor('#f5e6d5'))
c.circle(bx_c, by_c+1*mm, 38*mm, fill=1, stroke=0)
draw_serum_bottle(bx_c, by_c-30*mm, w=32*mm, h=62*mm, label='NIACINAMIDE', col=BURGUNDY)
burg_badge(bx_c+22*mm, by_c+22*mm, r=9*mm, text='#1', subtext='BESTSELLER')

rx = W*0.52
c.setFillColor(BURGUNDY)
c.setFont('Helvetica', 8)
c.drawString(rx, H-22*mm, 'SKIN BRIGHTENING SERUM')

c.setFillColor(DARK_BURGUNDY)
c.setFont('Helvetica-Bold', 18)
c.drawString(rx, H-32*mm, 'Niacinamide')
c.setFont('Helvetica-Bold', 18)
c.drawString(rx, H-41*mm, '5% Serum')

c.setFillColor(GOLD)
c.rect(rx, H-43.5*mm, 30*mm, 1.2*mm, fill=1, stroke=0)

c.setFillColor(CHARCOAL)
c.setFont('Helvetica', 8)
c.drawString(rx, H-47*mm, 'with SPF 30  .  30 ML')

c.setFillColor(BURGUNDY)
c.setFont('Helvetica-Bold', 13)
c.drawString(rx, H-55*mm, 'Rs. 349')
c.setFillColor(GREY)
c.setFont('Helvetica', 9)
c.drawString(rx+20*mm, H-54*mm, 'Rs. 699')
c.setStrokeColor(GREY)
c.setLineWidth(0.8)
c.line(rx+20*mm, H-53*mm, rx+36*mm, H-53*mm)

desc = ("An all-around skin hero with 5% Niacinamide and SPF 30. "
        "Regulates cell turnover, visibly reduces hyperpigmentation, "
        "dark spots and uneven tone. Lightweight, fast-absorbing — "
        "ideal for Indian climate.")
para(desc, rx, H-62*mm, W*0.45, 'Helvetica', CHARCOAL, 8, 12.5, TA_LEFT)

ben_y = H*0.45
c.setFillColor(BURGUNDY)
c.setFont('Helvetica-Bold', 9)
c.drawString(rx, ben_y, 'KEY BENEFITS')
divider(ben_y-3*mm, GOLD, 0.6)

benefits = [
    'Reduces hyperpigmentation & dark spots',
    'Controls excess oil production',
    'Brightens & evens skin tone',
    'Strengthens skin barrier',
    'SPF 30 sun protection',
]
for j, b in enumerate(benefits):
    by = ben_y - 10*mm - j*7*mm
    c.setFillColor(GOLD)
    c.circle(rx+2*mm, by+1.5*mm, 2*mm, fill=1, stroke=0)
    c.setFillColor(WHITE)
    c.setFont('Helvetica-Bold', 6)
    c.drawCentredString(rx+2*mm, by+0.8*mm, 'v')
    c.setFillColor(CHARCOAL)
    c.setFont('Helvetica', 8)
    c.drawString(rx+6*mm, by, b)

suit_y = H*0.22
c.setFillColor(BURGUNDY)
c.setFont('Helvetica-Bold', 8)
c.drawString(rx, suit_y, 'SUITABLE FOR')
skins = ['Oily', 'Combination', 'Normal', 'Sensitive']
for k, sk in enumerate(skins):
    skx = rx + k*22*mm
    c.setFillColor(IVORY)
    c.setStrokeColor(BURGUNDY)
    c.setLineWidth(0.5)
    c.roundRect(skx, suit_y-11*mm, 20*mm, 9*mm, 3, fill=1, stroke=1)
    c.setFillColor(BURGUNDY)
    c.setFont('Helvetica', 6.5)
    c.drawCentredString(skx+10*mm, suit_y-7*mm, sk)

star_rating(rx+18*mm, H*0.14, 4.5)
c.setFillColor(CHARCOAL)
c.setFont('Helvetica', 7)
c.drawString(rx+38*mm, H*0.135, '4.5 / 5  (200+ Reviews)')

c.setFillColor(BURGUNDY)
c.rect(0, 0, W, 8*mm, fill=1, stroke=0)
c.setFillColor(GOLD)
c.setFont('Helvetica', 7)
c.drawCentredString(W/2, 2.5*mm, '05')
c.showPage()

# ═══════════════════════════════════════════════════════════
# PAGE 6 — VITAMIN C SERUM
# ═══════════════════════════════════════════════════════════
bg(CREAM)

c.setFillColor(BURGUNDY)
c.rect(0, H-12*mm, W, 12*mm, fill=1, stroke=0)
c.setFillColor(GOLD)
c.setFont('Helvetica', 7)
c.drawCentredString(W/2, H-7.5*mm, 'SKIN BRIGHTENING  .  ANTIOXIDANT PROTECTION  .  ANTI-AGING')

c.setFillColor(colors.HexColor('#f5ede0'))
c.rect(0, 0, W/2-5*mm, H-12*mm, fill=1, stroke=0)

bx2 = W*0.26
by2 = H*0.52
c.setFillColor(colors.HexColor('#ffe8cc'))
c.circle(bx2, by2, 35*mm, fill=1, stroke=0)
draw_serum_bottle(bx2, by2-28*mm, w=30*mm, h=58*mm, label='VITAMIN C', col=colors.HexColor('#9b3a0a'))

rx2 = W*0.52
c.setFillColor(GREY)
c.setFont('Helvetica', 7.5)
c.drawString(rx2, H-20*mm, 'BRIGHTENING SERUM')
c.setFillColor(BURGUNDY)
c.setFont('Helvetica-Bold', 17)
c.drawString(rx2, H-29*mm, 'Vitamin C')
c.setFont('Helvetica-Bold', 17)
c.drawString(rx2, H-38*mm, 'Serum')
c.setFillColor(GOLD)
c.rect(rx2, H-40.5*mm, 28*mm, 1.2*mm, fill=1, stroke=0)
c.setFillColor(CHARCOAL)
c.setFont('Helvetica', 8)
c.drawString(rx2, H-44*mm, 'Night Care  .  30 ML  .  Rs. 349')

desc2 = ("Powered by Ethyl Ascorbic Acid, the most stable form of Vitamin C, "
         "this serum fights free radicals, fades scars and delivers a "
         "visibly brighter, even-toned complexion with regular use.")
para(desc2, rx2, H-52*mm, W*0.44, 'Helvetica', CHARCOAL, 8, 12.5, TA_LEFT)

ing_y = H*0.48
c.setFillColor(BURGUNDY)
c.setFont('Helvetica-Bold', 9)
c.drawString(rx2, ing_y, 'HERO INGREDIENTS')
divider(ing_y-3*mm, GOLD, 0.6)
ings = [
    ('Ethyl Ascorbic Acid', 'Stable Vit C  .  Brightens'),
    ('Hyaluronic Acid', 'Deep Hydration'),
    ('Alpha Arbutin', 'Fades Dark Spots'),
    ('Aloe Vera Extract', 'Soothes & Heals'),
    ('Rice Water Extract', 'Brightening'),
]
for j, (iname, idesc) in enumerate(ings):
    iy = ing_y - 9*mm - j*7.5*mm
    c.setFillColor(IVORY)
    c.setStrokeColor(GOLD)
    c.setLineWidth(0.5)
    c.roundRect(rx2, iy-5*mm, W*0.44, 7*mm, 3, fill=1, stroke=1)
    c.setFillColor(BURGUNDY)
    c.setFont('Helvetica-Bold', 7)
    c.drawString(rx2+3*mm, iy-0.5*mm, iname)
    c.setFillColor(GREY)
    c.setFont('Helvetica', 6.5)
    c.drawString(rx2+3*mm, iy-3.5*mm, idesc)

htu_y = H*0.2
c.setFillColor(BURGUNDY)
c.setFont('Helvetica-Bold', 8.5)
c.drawString(rx2, htu_y, 'HOW TO USE')
steps2 = [
    'Apply after cleansing at night',
    'Use 2-3 drops on face & neck',
    'Follow with moisturiser',
    'Always use SPF in daytime'
]
for j, s in enumerate(steps2):
    c.setFillColor(BURGUNDY)
    c.circle(rx2+3*mm, htu_y-9*mm-j*6.5*mm+1.5*mm, 3*mm, fill=1, stroke=0)
    c.setFillColor(WHITE)
    c.setFont('Helvetica-Bold', 6)
    c.drawCentredString(rx2+3*mm, htu_y-9*mm-j*6.5*mm+0.8*mm, str(j+1))
    c.setFillColor(CHARCOAL)
    c.setFont('Helvetica', 7.5)
    c.drawString(rx2+8*mm, htu_y-9*mm-j*6.5*mm, s)

c.setFillColor(BURGUNDY)
c.rect(0, 0, W, 8*mm, fill=1, stroke=0)
c.setFillColor(GOLD)
c.setFont('Helvetica', 7)
c.drawCentredString(W/2, 2.5*mm, '06')
c.showPage()

# ═══════════════════════════════════════════════════════════
# PAGE 7 — RETINOL + LIQUID SUNSCREEN
# ═══════════════════════════════════════════════════════════
bg(CREAM)

c.setFillColor(BURGUNDY)
c.rect(0, H-12*mm, W, 12*mm, fill=1, stroke=0)
c.setFillColor(GOLD)
c.setFont('Helvetica', 7)
c.drawCentredString(W/2, H-7.5*mm, 'ANTI-AGING COLLECTION  .  CLINICAL ACTIVES')
c.setFillColor(GOLD)
c.rect(0, H-13.5*mm, W, 1.5*mm, fill=1, stroke=0)

c.setStrokeColor(GOLD)
c.setLineWidth(0.8)
c.line(W/2, 10*mm, W/2, H-15*mm)

rx3 = 16*mm
c.setFillColor(BURGUNDY)
c.setFont('Helvetica-Bold', 12)
c.drawString(rx3, H-22*mm, 'Retinol Night')
c.drawString(rx3, H-30*mm, 'Repair Serum')
c.setFillColor(GOLD)
c.rect(rx3, H-32.5*mm, 22*mm, 1.2*mm, fill=1, stroke=0)
c.setFillColor(GREY)
c.setFont('Helvetica', 7.5)
c.drawString(rx3, H-36*mm, '30 ML  .  Rs. 349')

draw_serum_bottle(rx3+25*mm, H*0.58-10*mm, w=26*mm, h=50*mm, label='RETINOL', col=DARK_BURGUNDY)

desc3 = ("Works while you sleep to visibly reduce fine lines, "
         "freckles and signs of aging. Suitable for all skin types, "
         "including acne-prone. Best used as night-care routine.")
para(desc3, rx3, H-44*mm, W/2-22*mm, 'Helvetica', CHARCOAL, 7.8, 12, TA_LEFT)

bens3 = ['Reduces fine lines & wrinkles', 'Clears acne & freckles', 'Boosts collagen synthesis', 'Evens skin tone overnight']
c.setFillColor(BURGUNDY)
c.setFont('Helvetica-Bold', 8)
c.drawString(rx3, H*0.52, 'BENEFITS')
for j, b in enumerate(bens3):
    c.setFillColor(GOLD)
    c.setFont('Helvetica-Bold', 9)
    c.drawString(rx3, H*0.46-j*6*mm, '>')
    c.setFillColor(CHARCOAL)
    c.setFont('Helvetica', 7.5)
    c.drawString(rx3+6*mm, H*0.46-j*6*mm, b)

c.setFillColor(DARK_BURGUNDY)
c.setFont('Helvetica-Bold', 7)
c.drawString(rx3, H*0.22, 'HOW TO USE')
c.setFillColor(CHARCOAL)
c.setFont('Helvetica', 7)
c.drawString(rx3, H*0.18, 'Apply at night after cleansing.')
c.drawString(rx3, H*0.145, 'Sandwich method recommended:')
c.drawString(rx3, H*0.11, 'Moisturiser > Retinol > Moisturiser')
c.setFillColor(BURGUNDY)
c.setFont('Helvetica', 6.5)
c.drawString(rx3, H*0.075, '! Always follow with SPF during daytime')

rx4 = W/2 + 8*mm
c.setFillColor(BURGUNDY)
c.setFont('Helvetica-Bold', 12)
c.drawString(rx4, H-22*mm, 'Liquid Sunscreen')
c.drawString(rx4, H-30*mm, 'SPF 50+')
c.setFillColor(GOLD)
c.rect(rx4, H-32.5*mm, 22*mm, 1.2*mm, fill=1, stroke=0)
c.setFillColor(GREY)
c.setFont('Helvetica', 7.5)
c.drawString(rx4, H-36*mm, 'All Skin Types  .  Rs. 399')

draw_serum_bottle(rx4+26*mm, H*0.58-10*mm, w=26*mm, h=50*mm, label='SPF 50+', col=colors.HexColor('#b87333'))

desc4 = ("Lightweight liquid sunscreen suitable for all skin types, "
         "especially acne-prone skin. Hydrating with UV protection, "
         "balances UV radiation and prevents premature aging.")
para(desc4, rx4, H-44*mm, W/2-22*mm, 'Helvetica', CHARCOAL, 7.8, 12, TA_LEFT)

bens4 = ['Broad-spectrum SPF 50+ protection', 'Hydrates while protecting', 'Non-greasy, fast absorbing', 'Acne-prone skin friendly']
c.setFillColor(BURGUNDY)
c.setFont('Helvetica-Bold', 8)
c.drawString(rx4, H*0.52, 'BENEFITS')
for j, b in enumerate(bens4):
    c.setFillColor(GOLD)
    c.setFont('Helvetica-Bold', 9)
    c.drawString(rx4, H*0.46-j*6*mm, '>')
    c.setFillColor(CHARCOAL)
    c.setFont('Helvetica', 7.5)
    c.drawString(rx4+6*mm, H*0.46-j*6*mm, b)

c.setFillColor(DARK_BURGUNDY)
c.setFont('Helvetica-Bold', 7)
c.drawString(rx4, H*0.22, 'HOW TO USE')
steps4 = ['Apply as last step in AM routine', 'Use 2 fingers worth of product', 'Reapply every 2-3 hours if outdoors']
for j, s in enumerate(steps4):
    c.setFillColor(CHARCOAL)
    c.setFont('Helvetica', 7)
    c.drawString(rx4, H*0.18-j*5.5*mm, f'{j+1}. {s}')

c.setFillColor(BURGUNDY)
c.rect(0, 0, W, 8*mm, fill=1, stroke=0)
c.setFillColor(GOLD)
c.setFont('Helvetica', 7)
c.drawCentredString(W/2, 2.5*mm, '07')
c.showPage()

# ═══════════════════════════════════════════════════════════
# PAGE 8 — SKINCARE ROUTINE GUIDE
# ═══════════════════════════════════════════════════════════
bg(IVORY)

c.setFillColor(BURGUNDY)
c.rect(0, H-16*mm, W, 16*mm, fill=1, stroke=0)
c.setFillColor(GOLD)
c.setFont('Helvetica-Bold', 10)
c.drawCentredString(W/2, H-10*mm, 'YOUR BODILICIOUS SKIN ROUTINE')
c.setFillColor(GOLD)
c.rect(0, H-17.5*mm, W, 1.5*mm, fill=1, stroke=0)

section_header('Build Your Routine', 'Morning & Night — Every Step Matters', y=H-32*mm)

col_w = (W - 36*mm) / 2
lx = 16*mm
rx_r = 16*mm + col_w + 4*mm

def routine_column(x, title, steps, y_start, col_w):
    c.setFillColor(BURGUNDY)
    c.roundRect(x, y_start, col_w, 12*mm, 6, fill=1, stroke=0)
    c.setFillColor(GOLD)
    c.setFont('Helvetica-Bold', 9)
    c.drawCentredString(x+col_w/2, y_start+4*mm, title)

    step_y = y_start - 6*mm
    for i, (step_name, product, note) in enumerate(steps):
        sy = step_y - i*18*mm
        c.setFillColor(GOLD)
        c.circle(x+5*mm, sy, 4.5*mm, fill=1, stroke=0)
        c.setFillColor(WHITE)
        c.setFont('Helvetica-Bold', 7)
        c.drawCentredString(x+5*mm, sy-1.5*mm, str(i+1))
        c.setFillColor(CREAM)
        c.setStrokeColor(LIGHT_GREY)
        c.setLineWidth(0.5)
        c.roundRect(x+11*mm, sy-5.5*mm, col_w-14*mm, 11*mm, 3, fill=1, stroke=1)
        c.setFillColor(BURGUNDY)
        c.setFont('Helvetica-Bold', 7.5)
        c.drawString(x+14*mm, sy+1.5*mm, step_name)
        c.setFillColor(GREY)
        c.setFont('Helvetica', 6.5)
        c.drawString(x+14*mm, sy-3*mm, product)

morning_steps = [
    ('CLEANSE', 'Rose Face Wash / Olive Oil Soap', ''),
    ('TONE', 'Saf Gel / Aloe Toner', ''),
    ('TREAT', 'Niacinamide 5% Serum SPF 30', ''),
    ('MOISTURISE', 'Oats Protein Moisturiser', ''),
    ('PROTECT', 'Liquid Sunscreen SPF 50+', ''),
]
night_steps = [
    ('CLEANSE', 'Brightening Face Wash', ''),
    ('EXFOLIATE', 'AHA/BHA Serum (2-3x/week)', ''),
    ('TREAT', 'Retinol Night Repair Serum', ''),
    ('MOISTURISE', 'Collagen Night Cream', ''),
    ('EYE CARE', 'Hyaluronic Acid Serum', ''),
]

routine_column(lx, 'MORNING ROUTINE  [ AM ]', morning_steps, H-48*mm, col_w)
routine_column(rx_r, 'NIGHT ROUTINE  [ PM ]', night_steps, H-48*mm, col_w)

tip_y = 18*mm
c.setFillColor(colors.HexColor('#f0e4d4'))
c.roundRect(16*mm, tip_y, W-32*mm, 14*mm, 6, fill=1, stroke=0)
c.setFillColor(BURGUNDY)
c.setFont('Helvetica-Bold', 8)
c.drawString(22*mm, tip_y+9*mm, 'PRO TIP:')
c.setFillColor(CHARCOAL)
c.setFont('Helvetica', 7.5)
c.drawString(22*mm, tip_y+4*mm, 'Introduce actives (Retinol, AHA/BHA) gradually. Start 2x/week and increase as your skin adjusts.')

c.setFillColor(BURGUNDY)
c.rect(0, 0, W, 8*mm, fill=1, stroke=0)
c.setFillColor(GOLD)
c.setFont('Helvetica', 7)
c.drawCentredString(W/2, 2.5*mm, '08')
c.showPage()

# ═══════════════════════════════════════════════════════════
# PAGE 9 — INGREDIENT PHILOSOPHY
# ═══════════════════════════════════════════════════════════
bg(CREAM)

c.setFillColor(BURGUNDY)
c.rect(0, H-16*mm, W, 16*mm, fill=1, stroke=0)
c.setFillColor(GOLD)
c.setFont('Helvetica-Bold', 10)
c.drawCentredString(W/2, H-10*mm, 'INGREDIENT PHILOSOPHY')
c.setFillColor(GOLD)
c.rect(0, H-17.5*mm, W, 1.5*mm, fill=1, stroke=0)

section_header('What Goes In Matters', 'Every ingredient chosen for a reason', y=H-32*mm)

ingredients_pg = [
    ('Niacinamide', 'Vitamin B3', 'Reduces pores, controls sebum, brightens skin tone and fades dark spots', '#7d1a1a'),
    ('Hyaluronic Acid', 'Humectant', 'Holds 1000x its weight in water — plumps, hydrates and supports barrier', '#5a3e2b'),
    ('Retinol', 'Vitamin A', 'Gold standard anti-aging — accelerates cell turnover, reduces fine lines', '#7d1a1a'),
    ('Centella Asiatica', 'Herbal Active', 'Calms inflammation, repairs skin barrier, ideal for sensitive skin', '#2d5a27'),
    ('Vitamin C', 'Antioxidant', 'Neutralises free radicals, brightens complexion, boosts collagen production', '#b87333'),
    ('AHA / BHA', 'Exfoliants', 'Resurfaces skin, clears pores, improves texture and radiance', '#5a0f0f'),
]

icard_w = (W - 36*mm) / 3
icard_h = 28*mm
isx = 16*mm
isy = H - 56*mm

for i, (iname, itype, idesc, icol) in enumerate(ingredients_pg):
    row = i // 3
    col = i % 3
    ix = isx + col*(icard_w+2*mm)
    iy = isy - row*(icard_h+4*mm)

    c.setFillColor(IVORY)
    c.setStrokeColor(colors.HexColor(icol))
    c.setLineWidth(0.8)
    c.roundRect(ix, iy-icard_h, icard_w, icard_h, 5, fill=1, stroke=1)

    c.setFillColor(colors.HexColor(icol))
    c.roundRect(ix, iy-6*mm, icard_w, 6*mm, 5, fill=1, stroke=0)
    c.setFillColor(CREAM)
    c.rect(ix, iy-8*mm, icard_w, 2*mm, fill=1, stroke=0)

    c.setFillColor(WHITE)
    c.setFont('Helvetica-Bold', 7)
    c.drawCentredString(ix+icard_w/2, iy-4.5*mm, iname)

    c.setFillColor(colors.HexColor(icol))
    c.setFont('Helvetica', 6)
    c.drawCentredString(ix+icard_w/2, iy-9*mm, itype.upper())

    para(idesc, ix+3*mm, iy-12*mm, icard_w-6*mm, 'Helvetica', CHARCOAL, 6.5, 10, TA_LEFT)

never_y = 28*mm
c.setFillColor(DARK_BURGUNDY)
c.roundRect(16*mm, never_y, W-32*mm, 16*mm, 6, fill=1, stroke=0)
c.setFillColor(WHITE)
c.setFont('Helvetica-Bold', 8)
c.drawCentredString(W/2, never_y+11*mm, 'WHAT WE NEVER USE')
c.setFont('Helvetica', 7)
never = ['Sulphates', 'Parabens', 'Synthetic Fragrances', 'Mineral Oil', 'Formaldehyde', 'Phthalates']
c.drawCentredString(W/2, never_y+5*mm, '  X  '.join(never))

c.setFillColor(BURGUNDY)
c.rect(0, 0, W, 8*mm, fill=1, stroke=0)
c.setFillColor(GOLD)
c.setFont('Helvetica', 7)
c.drawCentredString(W/2, 2.5*mm, '09')
c.showPage()

# ═══════════════════════════════════════════════════════════
# PAGE 10 — MANUFACTURING + TESTIMONIALS
# ═══════════════════════════════════════════════════════════
bg(IVORY)

c.setFillColor(BURGUNDY)
c.rect(0, H-16*mm, W, 16*mm, fill=1, stroke=0)
c.setFillColor(GOLD)
c.setFont('Helvetica-Bold', 10)
c.drawCentredString(W/2, H-10*mm, 'MADE WITH INTEGRITY  .  LOVED BY THOUSANDS')
c.setFillColor(GOLD)
c.rect(0, H-17.5*mm, W, 1.5*mm, fill=1, stroke=0)

c.setFillColor(colors.HexColor('#f0e4d4'))
c.roundRect(10*mm, H/2+2*mm, W/2-15*mm, H/2-24*mm, 8, fill=1, stroke=0)
c.setStrokeColor(GOLD)
c.setLineWidth(0.8)
c.roundRect(10*mm, H/2+2*mm, W/2-15*mm, H/2-24*mm, 8, fill=0, stroke=1)

c.setFillColor(BURGUNDY)
c.setFont('Helvetica-Bold', 11)
c.drawCentredString(W/4-2*mm, H-28*mm, 'Our Own')
c.drawCentredString(W/4-2*mm, H-36*mm, 'Manufacturing')
c.setFillColor(GOLD)
c.rect(22*mm, H-38.5*mm, 25*mm, 1.2*mm, fill=1, stroke=0)

mfg_text = ("Every Bodilicious product is formulated and manufactured "
            "in-house at our own facility in Chennai. This means:\n\n"
            "- Complete quality control at every step\n"
            "- No third-party outsourcing\n"
            "- Freshly made in small batches\n"
            "- Transparent ingredient sourcing\n"
            "- Direct farm-to-bottle herbal extracts\n\n"
            "We don't just brand products — we build them, "
            "from raw ingredient to final bottle. That's why "
            "every product carries our promise.")
para(mfg_text, 14*mm, H-43*mm, W/2-20*mm, 'Helvetica', CHARCOAL, 7.8, 12, TA_LEFT)

# Factory icon (drawn, not emoji)
c.setFillColor(BURGUNDY)
c.rect(W/4-8*mm, H*0.53, 16*mm, 10*mm, fill=1, stroke=0)  # Building body
c.setFillColor(DARK_BURGUNDY)
c.rect(W/4-6*mm, H*0.54, 4*mm, 4*mm, fill=1, stroke=0)  # Window
c.rect(W/4+2*mm, H*0.54, 4*mm, 4*mm, fill=1, stroke=0)  # Window
c.setFillColor(BURGUNDY)
c.rect(W/4-3*mm, H*0.53, 6*mm, 6*mm, fill=1, stroke=0)  # Door
# Chimney
c.setFillColor(DARK_BURGUNDY)
c.rect(W/4+3*mm, H*0.63, 3*mm, 5*mm, fill=1, stroke=0)
c.setFillColor(GOLD)
c.setFont('Helvetica-Bold', 7)
c.drawCentredString(W/4-2*mm, H*0.51, 'PROUDLY MADE IN INDIA')

tx = W/2 + 5*mm
twidth = W/2 - 16*mm

c.setFillColor(BURGUNDY)
c.setFont('Helvetica-Bold', 11)
c.drawString(tx, H-28*mm, 'Customer Love')
c.setFillColor(GOLD)
c.rect(tx, H-30.5*mm, 22*mm, 1.2*mm, fill=1, stroke=0)

reviews = [
    (4.5, 'Priya S., Chennai',
     '"The Niacinamide serum truly rejuvenated my skin texture. '
     'My pigmentation is visibly fading — I\'m obsessed!"'),
    (5.0, 'Kavitha R., Bangalore',
     '"The Vitamin C serum made my face glow and look brighter '
     'within 2 weeks. Best night care product I\'ve used."'),
    (4.5, 'Meera T., Coimbatore',
     '"The Milk Protein shampoo stopped my hair fall completely. '
     'My hair is now soft and healthy. Highly recommend!"'),
]

ry = H-36*mm
for rating, reviewer, text in reviews:
    c.setFillColor(CREAM)
    c.setStrokeColor(LIGHT_GREY)
    c.setLineWidth(0.5)
    c.roundRect(tx, ry-26*mm, twidth, 25*mm, 5, fill=1, stroke=1)
    c.setFillColor(BURGUNDY)
    c.roundRect(tx, ry-26*mm, 2*mm, 25*mm, 3, fill=1, stroke=0)
    star_rating(tx+15*mm, ry-5*mm, rating, 3.5)
    c.setFillColor(GREY)
    c.setFont('Helvetica', 6.5)
    c.drawString(tx+38*mm, ry-6*mm, reviewer)
    para(text, tx+5*mm, ry-11*mm, twidth-8*mm, 'Helvetica', CHARCOAL, 7.5, 11.5)
    ry -= 30*mm

c.setFillColor(BURGUNDY)
c.roundRect(tx, ry-12*mm, twidth, 11*mm, 5, fill=1, stroke=0)
c.setFillColor(GOLD)
c.setFont('Helvetica-Bold', 8)
c.drawCentredString(tx+twidth/2, ry-7*mm, '4.7 / 5  Average Rating  .  500+ Happy Customers')

c.setFillColor(BURGUNDY)
c.rect(0, 0, W, 8*mm, fill=1, stroke=0)
c.setFillColor(GOLD)
c.setFont('Helvetica', 7)
c.drawCentredString(W/2, 2.5*mm, '10')
c.showPage()

# ═══════════════════════════════════════════════════════════
# PAGE 11 — FAQ
# ═══════════════════════════════════════════════════════════
bg(CREAM)

c.setFillColor(BURGUNDY)
c.rect(0, H-16*mm, W, 16*mm, fill=1, stroke=0)
c.setFillColor(GOLD)
c.setFont('Helvetica-Bold', 10)
c.drawCentredString(W/2, H-10*mm, 'FREQUENTLY ASKED QUESTIONS')
c.setFillColor(GOLD)
c.rect(0, H-17.5*mm, W, 1.5*mm, fill=1, stroke=0)

section_header("We've Got Answers", 'Everything you need to know', y=H-32*mm)

faqs = [
    ("Is it suitable for sensitive skin?",
     "Yes! All Bodilicious products are formulated with gentle actives and tested for sensitive skin compatibility. "
     "We recommend patch-testing any new product on your wrist before facial use."),
    ("Can pregnant women use Bodilicious products?",
     "While most products are safe, we advise avoiding Retinol-containing products during pregnancy. "
     "Consult your dermatologist for personalised guidance during pregnancy or breastfeeding."),
    ("How long before I see results?",
     "Most customers notice visible improvement in skin texture and tone within 2-4 weeks of consistent use. "
     "For concerns like hyperpigmentation, allow 6-8 weeks for best results."),
    ("Are the products fragrance-free?",
     "Bodilicious products contain no synthetic fragrances. Any scent comes purely from natural herbal "
     "extracts and botanical ingredients used in the formulation."),
    ("Are products suitable for Indian climate?",
     "Absolutely! Every formula is specifically tested and optimised for India's diverse climate — "
     "from Chennai's humidity to Delhi's dry winters."),
    ("Do you test on animals?",
     "Never. Bodilicious is completely cruelty-free. No animal testing is conducted at any stage "
     "of our product development."),
]

faq_y = H - 52*mm
faq_w = (W - 36*mm) / 2
left_x = 16*mm
right_x = 16*mm + faq_w + 4*mm

for i, (q, a) in enumerate(faqs):
    col_x = left_x if i % 2 == 0 else right_x
    fy = faq_y - (i // 2) * 38*mm

    c.setFillColor(IVORY)
    c.setStrokeColor(GOLD)
    c.setLineWidth(0.5)
    c.roundRect(col_x, fy-34*mm, faq_w, 34*mm, 5, fill=1, stroke=1)
    c.setFillColor(BURGUNDY)
    c.roundRect(col_x, fy-10*mm, faq_w, 10*mm, 5, fill=1, stroke=0)
    # Ensure question text doesn't overflow the header band
    c.setFillColor(WHITE)
    c.setFont('Helvetica-Bold', 7)
    # Clip question to fit in header
    q_short = q if len(q) < 50 else q[:47] + '...'
    c.drawString(col_x+4*mm, fy-5*mm, f'Q: {q_short}')
    para(a, col_x+4*mm, fy-13*mm, faq_w-8*mm, 'Helvetica', CHARCOAL, 7, 10.5)

c.setFillColor(BURGUNDY)
c.rect(0, 0, W, 8*mm, fill=1, stroke=0)
c.setFillColor(GOLD)
c.setFont('Helvetica', 7)
c.drawCentredString(W/2, 2.5*mm, '11')
c.showPage()

# ═══════════════════════════════════════════════════════════
# PAGE 12 — CONTACT / ORDERING
# ═══════════════════════════════════════════════════════════
bg(IVORY)

c.setFillColor(BURGUNDY)
c.rect(0, H-16*mm, W, 16*mm, fill=1, stroke=0)
c.setFillColor(GOLD)
c.setFont('Helvetica-Bold', 10)
c.drawCentredString(W/2, H-10*mm, 'SHOP  .  CONNECT  .  ORDER')
c.setFillColor(GOLD)
c.rect(0, H-17.5*mm, W, 1.5*mm, fill=1, stroke=0)

section_header('Get In Touch', "We'd love to hear from you", y=H-32*mm)

# Contact cards
contacts = [
    ('WEB', 'WEBSITE', 'www.bodilicious.in', 'Shop our full range online'),
    ('IG', 'INSTAGRAM', '@bodilicious.in', 'Skincare tips, tutorials & offers'),
    ('MAIL', 'EMAIL', 'support@bodilicious.in', 'Customer care & queries'),
    ('SHIP', 'FREE SHIPPING', 'Orders above Rs. 1500', 'Pan India delivery'),
]

card_w = (W - 40*mm) / 2
card_h = 30*mm
csx = 16*mm
csy = H - 65*mm

for i, (icon_label, label, value, sub) in enumerate(contacts):
    row = i // 2
    col = i % 2
    cx_c = csx + col*(card_w+8*mm)
    cy_c = csy - row*(card_h+5*mm)

    c.setFillColor(CREAM)
    c.setStrokeColor(BURGUNDY)
    c.setLineWidth(0.7)
    c.roundRect(cx_c, cy_c-card_h, card_w, card_h, 6, fill=1, stroke=1)

    # Draw circle icon instead of emoji
    c.setFillColor(BURGUNDY)
    c.circle(cx_c+8*mm, cy_c-card_h/2, 6*mm, fill=1, stroke=0)
    c.setFillColor(WHITE)
    c.setFont('Helvetica-Bold', 5.5)
    c.drawCentredString(cx_c+8*mm, cy_c-card_h/2-2, icon_label)

    c.setFillColor(BURGUNDY)
    c.setFont('Helvetica-Bold', 7.5)
    c.drawString(cx_c+17*mm, cy_c-8*mm, label)
    c.setFillColor(DARK_BURGUNDY)
    c.setFont('Helvetica-Bold', 8.5)
    c.drawString(cx_c+17*mm, cy_c-14*mm, value)
    c.setFillColor(GREY)
    c.setFont('Helvetica', 6.8)
    c.drawString(cx_c+17*mm, cy_c-19*mm, sub)

# Store address
addr_y = 68*mm
c.setFillColor(colors.HexColor('#f0e4d4'))
c.roundRect(16*mm, addr_y, W-32*mm, 14*mm, 6, fill=1, stroke=0)
c.setStrokeColor(GOLD)
c.setLineWidth(0.6)
c.roundRect(16*mm, addr_y, W-32*mm, 14*mm, 6, fill=0, stroke=1)
c.setFillColor(BURGUNDY)
c.setFont('Helvetica-Bold', 7.5)
c.drawCentredString(W/2, addr_y+9.5*mm, 'REGISTERED ADDRESS')
c.setFillColor(CHARCOAL)
c.setFont('Helvetica', 7)
c.drawCentredString(W/2, addr_y+5.5*mm, 'Bodilicious Natural Products, Chennai, Tamil Nadu — India')
c.setFillColor(GREY)
c.setFont('Helvetica', 6.5)
c.drawCentredString(W/2, addr_y+2*mm, 'GSTIN: Available on invoice  .  +91 98944 51947')

# QR code placeholder
qr_y = 22*mm
qr_x = W/2 - 18*mm
c.setFillColor(WHITE)
c.setStrokeColor(BURGUNDY)
c.setLineWidth(1.2)
c.roundRect(qr_x, qr_y, 36*mm, 36*mm, 4, fill=1, stroke=1)

# QR pattern placeholder
c.setFillColor(BURGUNDY)
for qi in range(3):
    for qj in range(3):
        if not (qi == 1 and qj == 1):
            c.rect(qr_x+3*mm+qi*10*mm, qr_y+3*mm+qj*10*mm, 9*mm, 9*mm, fill=1, stroke=0)
c.setFillColor(WHITE)
c.rect(qr_x+4*mm, qr_y+4*mm, 7*mm, 7*mm, fill=1, stroke=0)
c.rect(qr_x+14*mm, qr_y+4*mm, 7*mm, 7*mm, fill=1, stroke=0)
c.rect(qr_x+4*mm, qr_y+14*mm, 7*mm, 7*mm, fill=1, stroke=0)
c.setFillColor(BURGUNDY)
c.rect(qr_x+5*mm, qr_y+5*mm, 5*mm, 5*mm, fill=1, stroke=0)
c.rect(qr_x+15*mm, qr_y+5*mm, 5*mm, 5*mm, fill=1, stroke=0)
c.rect(qr_x+5*mm, qr_y+15*mm, 5*mm, 5*mm, fill=1, stroke=0)

random.seed(42)
for _ in range(40):
    dx = qr_x+3*mm+random.random()*30*mm
    dy = qr_y+3*mm+random.random()*30*mm
    c.setFillColor(BURGUNDY)
    c.rect(dx, dy, 2.5, 2.5, fill=1, stroke=0)

c.setFillColor(CHARCOAL)
c.setFont('Helvetica', 7)
c.drawCentredString(W/2, qr_y-4*mm, 'Scan to visit www.bodilicious.in')

c.setFillColor(BURGUNDY)
c.rect(0, 0, W, 8*mm, fill=1, stroke=0)
c.setFillColor(GOLD)
c.setFont('Helvetica', 7)
c.drawCentredString(W/2, 2.5*mm, '12')
c.showPage()

# ═══════════════════════════════════════════════════════════
# PAGE 13 — BACK COVER
# ═══════════════════════════════════════════════════════════
bg(BURGUNDY)

c.setFillColor(DARK_BURGUNDY)
c.circle(W*0.15, H*0.8, 40*mm, fill=1, stroke=0)
c.circle(W*0.85, H*0.2, 35*mm, fill=1, stroke=0)
c.setFillColor(colors.HexColor('#6b1515'))
c.circle(W*0.5, H*0.1, 25*mm, fill=1, stroke=0)

c.setStrokeColor(GOLD)
c.setLineWidth(1.2)
c.rect(12*mm, 12*mm, W-24*mm, H-24*mm, fill=0, stroke=1)
c.setLineWidth(0.4)
c.rect(14*mm, 14*mm, W-28*mm, H-28*mm, fill=0, stroke=1)

draw_logo(W/2, H*0.62, size=36*mm)

c.setFillColor(GOLD_LIGHT)
c.setFont('Helvetica', 10)
c.drawCentredString(W/2, H*0.44, 'Science-Backed  .  Herbal-Powered  .  India-Proud')

divider(H*0.41, GOLD, 0.8)

c.setFillColor(WHITE)
c.setFont('Helvetica', 9)
c.drawCentredString(W/2, H*0.36, 'www.bodilicious.in')
c.setFillColor(GOLD_LIGHT)
c.setFont('Helvetica', 8)
c.drawCentredString(W/2, H*0.31, '@bodilicious.in  .  support@bodilicious.in  .  +91 98944 51947')

c.setFillColor(GOLD)
c.setFont('Helvetica-Bold', 7.5)
c.drawCentredString(W/2, H*0.24, 'Sulphate Free  .  Paraben Free  .  Cruelty Free  .  Dermatologically Tested')

c.setFillColor(colors.HexColor('#e8d5a3'))
c.setFont('Helvetica', 8)
c.drawCentredString(W/2, H*0.18, 'Made with love in Chennai, Tamil Nadu, India')

c.setFillColor(GOLD)
c.setFont('Helvetica', 7)
c.drawCentredString(W/2, 18*mm, '(c) 2025 Bodilicious Natural Products. All Rights Reserved.')
c.drawCentredString(W/2, 13*mm, 'Prices are indicative and subject to change. Visit website for current pricing.')

c.showPage()

# ─── SAVE ─────────────────────────────────────────────────────────────────────
c.save()
print(f"PDF saved to: {OUTPUT}")
