# Leggi le Note

Web app (PWA) per imparare a leggere le note sul pentagramma: mostra una nota,
ascolta il pianoforte dal microfono e ti dice se l'hai suonata giusta.

Nessuna dipendenza e nessuna build: HTML, CSS e JavaScript puri.

## Provarla sul computer

```sh
python3 -m http.server 8000
# apri http://localhost:8000
```

## Usarla sul telefono

Il browser concede il microfono solo su **HTTPS** (o su `localhost`), quindi va pubblicata.
Il modo più semplice è GitHub Pages: carica la cartella in un repository,
Settings → Pages → "Deploy from branch". Poi apri il link dal telefono e usa
"Aggiungi a schermata Home" per averla come app.

## Livelli

1. Primi passi: chiave di violino, Do centrale–Sol
2. Un'ottava: chiave di violino, Do4–Do5
3. Tutto il pentagramma: chiave di violino con tagli addizionali, La3–Do6
4. Chiave di basso: Do3–Do centrale
5. Basso completo: Mi2–Mi4
6. Doppio pentagramma: violino e basso insieme, Fa2–Sol5
7. Alterazioni: come il 6, con ♯ e ♭

## Brano da file MIDI

Dal menu dei livelli scegli "🎵 Brano da file MIDI" e carica un file `.mid` dal telefono.
L'app mostra il brano sul pentagramma e avanza quando suoni la nota giusta (il ritmo non conta).

Il microfono riconosce una nota alla volta, quindi di ogni accordo si tiene una sola nota:
la più acuta ("Melodia") o la più grave ("Basso"). Se il file ha più tracce si può scegliere quale usare.
Brano e punto raggiunto restano salvati sul telefono.

## File

- `midi.js`: lettura dei file MIDI ed estrazione di una linea di note
- `app.js`: livelli, disegno del pentagramma (SVG), riconoscimento dell'altezza (algoritmo YIN), logica di gioco
- `style.css`: stile con tema chiaro e scuro
- `sw.js`, `manifest.webmanifest`, `icon.svg`: installazione come app e uso offline
