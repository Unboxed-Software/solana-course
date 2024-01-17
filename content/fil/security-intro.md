---
title: How to approach the Program Security module
objectives:
- maunawaan kung paano lumapit sa Module ng Seguridad ng Programa
---

Ang layunin ng modyul na ito ay ilantad ka sa iba't ibang uri ng karaniwang pagsasamantala sa seguridad na natatangi sa pagbuo ng Solana. Napakahusay naming ginawa ang module na ito mula sa isang pampublikong GitHub repository na tawag na Sealevel Attacks na ginawa ng mahusay na Armani Ferrante.

Maaaring iniisip mo: "hindi ba mayroon tayong aralin sa seguridad sa modyul 3?" Oo, tiyak na ginawa namin. Nais naming tiyakin na ang sinumang nagde-deploy ng mga programa sa Mainnet sa labas ng gate ay may kahit man lang pangunahing pag-unawa sa seguridad. At kung ikaw iyon, sana ang mga pangunahing prinsipyong natutunan mo sa araling iyon ay humantong sa pag-iwas mo sa ilang karaniwang pagsasamantala ng Solana nang mag-isa.

Ang modyul na ito ay nilalayong bumuo sa ibabaw ng araling iyon na may dalawang layunin sa isip:

1. Upang palawakin ang iyong kamalayan sa modelo ng programming ng Solana at ang mga lugar kung saan kailangan mong tumuon upang isara ang mga butas sa seguridad sa iyong mga programa
2. Upang ipakita sa iyo ang hanay ng mga tool na ibinigay ng Anchor upang matulungan kang panatilihing secure ang iyong mga programa

Kung dumaan ka sa aralin sa Pangunahing Seguridad, dapat mukhang pamilyar ang unang ilang aralin. Sila ay higit na sumasaklaw sa mga paksang tinalakay natin sa araling iyon. Pagkatapos nito, maaaring mukhang bago ang ilan sa mga pag-atake. Hinihikayat ka namin na dumaan sa lahat ng ito.

Ang huling bagay na tatawagin ay mas maraming mga aralin sa modyul na ito kaysa sa mga naunang modyul. At ang mga aralin ay hindi nakadepende sa isa't isa sa parehong paraan, kaya maaari kang tumalon nang kaunti pa kung gusto mo.

Sa orihinal, magkakaroon tayo ng mas marami, mas maiikling aralin sa modyul na ito. At bagama't maaaring mas maikli ang mga ito kaysa sa karaniwan, hindi gaanong mas maikli ang mga ito. Lumalabas na kahit na ang bawat isa sa mga kahinaan sa seguridad ay "simple," maraming dapat talakayin. Kaya't ang bawat aralin ay maaaring may kaunting prosa at higit pang mga snippet ng code, na ginagawang madali para sa mga mambabasa na pumili kung gaano kalalim ang gagawin. Ngunit, sa huli, ang bawat aralin ay ganap pa rin tulad ng dati upang talagang makakuha ka ng matatag na kaalaman sa bawat isa sa mga tinalakay na panganib sa seguridad.

Gaya ng nakasanayan, pinahahalagahan namin ang feedback. Good luck sa paghuhukay!