# Audit accessibilite et performance ServiceGO

Date : 21 octobre 2026

## Methode

Le scenario `npm run test:quality` utilise Chromium, axe-core et Lighthouse contre un serveur ServiceGO local. Il echoue en cas de violation axe serieuse ou critique, de debordement horizontal, de CLS superieur a 0,10 ou de score sous les seuils declares dans le test.

Contextes axe controles :

- accueil francais, ordinateur 1440 x 900 ;
- inscription arabe RTL, ordinateur 1440 x 900 ;
- inscription francaise, mobile 390 x 844 ;
- accueil arabe RTL, mobile 390 x 844.

## Resultats mesures

| Controle | Resultat |
| --- | ---: |
| Violations axe serieuses ou critiques | 0 dans les quatre contextes |
| Debordement horizontal | 0 dans les quatre contextes |
| Lighthouse performance mobile | 73 / 100 |
| Lighthouse accessibilite | 100 / 100 |
| Lighthouse bonnes pratiques | 96 / 100 |
| Lighthouse SEO | 92 / 100 |
| Largest Contentful Paint | 4 889 ms |
| Cumulative Layout Shift | 0 |
| Total Blocking Time | 267 ms |

Le symbole est en SVG, les photographies chargees sont en WebP et la photographie de Rabat est prechargee. Le LCP synthetique reste la principale marge d'amelioration. Un test sur appareils reels et reseaux mobiles reels demeure necessaire avant de qualifier les Core Web Vitals de terrain.

## Execution

```powershell
npm run dev
$env:SERVICEGO_URL = "http://127.0.0.1:8787"
npm run test:quality
```
