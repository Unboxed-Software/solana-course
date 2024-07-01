---
title: Oracles and Oracle Networks
objectives:
- Ipaliwanag kung bakit hindi madaling ma-access ng mga onchain program ang real-world na data nang mag-isa
- Ipaliwanag kung paano nireresolba ng mga orakulo ang problema sa pag-access ng real-world na data sa chain
- Ipaliwanag kung paano ginagawang mas mapagkakatiwalaan ang data ng mga incentivized na network ng oracle
- Mabisang timbangin ang mga kapalit sa pagitan ng paggamit ng iba't ibang uri ng orakulo
- Gumamit ng mga orakulo mula sa isang onchain na programa upang ma-access ang real-world na data
---

# TL;DR

- Ang mga Oracle ay mga serbisyong nagbibigay ng panlabas na data sa isang blockchain network
- Mayroong dalawang pangunahing provider ng Oracle sa Solana: **Switchboard** at **Pyth**
- Maaari kang bumuo ng iyong sariling Oracle upang lumikha ng isang pasadyang feed ng data
- Kailangan mong maging maingat sa pagpili ng iyong mga provider ng data feed

# Lesson

Ang Oracles ay mga serbisyong nagbibigay ng panlabas na data sa isang blockchain network. Ang mga blockchain ay likas na mga siled na kapaligiran na walang kaalaman sa labas ng mundo. Ang paghihigpit na ito ay likas na naglalagay ng limitasyon sa mga kaso ng paggamit para sa mga desentralisadong aplikasyon (dApps). Nagbibigay ang Oracles ng solusyon sa limitasyong ito sa pamamagitan ng paglikha ng isang desentralisadong paraan upang makakuha ng real-world na data na onchain.

Ang mga Oracle ay maaaring magbigay ng halos anumang uri ng data na onchain. Kasama sa mga halimbawa ang:

- Mga resulta ng mga kaganapang pampalakasan
- Data ng panahon
- Mga resulta ng halalan sa politika
- Data ng merkado
- Randomness

Habang ang eksaktong pagpapatupad ay maaaring mag-iba mula sa blockchain hanggang sa blockchain, sa pangkalahatan ang Oracles ay gumagana tulad ng sumusunod:

1. Ang data ay pinanggalingan off-chain.
2. Ang data na iyon ay na-publish onchain sa isang transaksyon at nakaimbak sa isang account.
3. Maaaring basahin ng mga program ang data na nakaimbak sa account at gamitin ito sa lohika nito.

Tatalakayin ng araling ito ang mga pangunahing kaalaman sa kung paano gumagana ang mga orakulo, ang estado ng mga orakulo sa Solana, at kung paano epektibong gumamit ng mga orakulo sa iyong pagbuo ng Solana.

## Trust and Oracle Networks

Ang pangunahing hadlang na kailangang malampasan ng mga orakulo ay ang pagtitiwala. Dahil ang mga blockchain ay nagsasagawa ng mga hindi maibabalik na transaksyong pinansyal, kailangang malaman ng mga developer at user na mapagkakatiwalaan nila ang bisa at katumpakan ng data ng oracle. Ang unang hakbang sa pagtitiwala sa isang orakulo ay ang pag-unawa kung paano ito ipinatupad.

Sa pangkalahatan, mayroong tatlong uri ng pagpapatupad:

1. Ang nag-iisang, sentralisadong orakulo ay naglalathala ng data na onchain.
     1. Pro: Ito ay simple; may isang pinagmumulan ng katotohanan.
     2. Con: Walang pumipigil sa provider ng oracle sa pagbibigay ng hindi tumpak na data.
2. Ang network ng mga orakulo ay nag-publish ng data at isang mekanismo ng pinagkasunduan ay ginagamit upang matukoy ang huling resulta.
     1. Pro: Ang pinagkasunduan ay ginagawang mas malamang na ang masamang data ay itinulak sa chain.
     2. Con: Walang paraan para ma-disincentivize ang mga masasamang aktor mula sa pag-publish ng masamang data at sinusubukang paniwalaan ang pinagkasunduan.
3. Oracle network na may ilang uri ng patunay ng mekanismo ng stake. I.e. nangangailangan ng mga orakulo na mag-stake ng mga token upang makalahok sa mekanismo ng pinagkasunduan. Sa bawat tugon, kung ang isang orakulo ay lumihis ng ilang threshold mula sa tinatanggap na hanay ng mga resulta, ang kanilang stake ay kukunin ng protocol at hindi na sila makakapag-ulat.
     1. Pro: Tinitiyak na walang isang orakulo ang makakaimpluwensya nang labis sa huling resulta, habang nagbibigay din ng insentibo sa mga tapat at tumpak na pagkilos.
     2. Con: Ang pagbuo ng mga desentralisadong network ay mahirap, ang mga insentibo ay kailangang mai-set up nang maayos at sapat para makakuha ng partisipasyon, atbp.

Depende sa kaso ng paggamit ng isang orakulo, ang alinman sa mga solusyon sa itaas ay maaaring ang tamang diskarte. Halimbawa, maaari kang maging ganap na handa na lumahok sa isang blockchain-based na laro na gumagamit ng mga sentralisadong orakulo upang mag-publish ng impormasyon ng gameplay sa chain.

Sa kabilang banda, maaaring hindi ka gaanong magtiwala sa isang sentralisadong orakulo na nagbibigay ng impormasyon sa presyo para sa mga aplikasyon sa pangangalakal.

Maaari kang lumikha ng maraming nakapag-iisang orakulo para sa iyong sariling mga application bilang isang paraan lamang upang makakuha ng access sa impormasyong nasa labas ng chain na kailangan mo. Gayunpaman, ang mga orakulo na iyon ay malamang na hindi gagamitin ng mas malawak na komunidad kung saan ang desentralisasyon ay isang pangunahing prinsipyo. Dapat ka ring mag-atubiling gumamit ng sentralisadong, third party na mga orakulo sa iyong sarili.

Sa isang perpektong mundo, lahat ng mahalaga at/o mahalagang data ay ibibigay sa chain sa pamamagitan ng isang napakahusay na network ng oracle sa pamamagitan ng mapagkakatiwalaang patunay ng mekanismo ng pinagkasunduan ng stake. Sa pamamagitan ng pagpapakilala ng mekanismo ng staking, nasa pinakamainam na interes ng mga provider ng oracle na tiyaking tumpak ang kanilang data para mapanatili ang kanilang mga staked na pondo.

Kahit na sinasabi ng isang network ng oracle na mayroong ganoong mekanismo ng pinagkasunduan, siguraduhing malaman ang mga panganib na kasangkot sa paggamit ng network. Kung ang kabuuang halaga na kasangkot sa mga downstream na aplikasyon ay mas malaki kaysa sa inilaan na stake ng orakulo, ang mga orakulo ay maaaring magkaroon pa rin ng sapat na insentibo upang makipagsabwatan.

Trabaho mong malaman kung paano na-configure ang Oracle Network at gumawa ng isang paghatol kung sila ay mapagkakatiwalaan. Sa pangkalahatan, ang Oracles ay dapat lamang gamitin para sa mga function na hindi kritikal sa misyon at dapat isaalang-alang ang mga pinakamasamang sitwasyon.

## Oracles on Solana

[Pyth](https://pyth.network) at [Switchboard](https://switchboard.xyz) ang dalawang pangunahing provider ng oracle sa Solana ngayon. Ang bawat isa ay natatangi at sumusunod sa bahagyang magkakaibang mga pagpipilian sa disenyo.

Ang **Pyth** ay pangunahing nakatuon sa data ng pananalapi na na-publish mula sa mga nangungunang institusyong pampinansyal. Ini-publish ng mga provider ng data ng Pyth ang mga update sa data ng merkado. Ang mga update na ito ay pinagsama-sama at nai-publish sa chain ng Pyth program. Ang data na nagmula sa Pyth ay hindi ganap na desentralisado dahil ang mga aprubadong tagapagbigay ng data lamang ang maaaring mag-publish ng data. Ang selling point ng Pyth ay ang data nito ay direktang sinusuri ng platform at nagmula sa mga institusyong pampinansyal, na tinitiyak ang mas mataas na kalidad.

Ang **Switchboard** ay isang ganap na desentralisadong oracle network at mayroong lahat ng uri ng data na magagamit. Tingnan ang lahat ng feed [sa kanilang website](https://app.switchboard.xyz/solana/devnet/explore) Bukod pa rito, sinuman ay maaaring magpatakbo ng isang Switchboard oracle at sinuman ay maaaring kumonsumo ng kanilang data. Nangangahulugan ito na kailangan mong maging masigasig tungkol sa pagsasaliksik ng mga feed. Pag-uusapan pa natin kung ano ang hahanapin mamaya sa aralin.

Ang switchboard ay sumusunod sa isang variation ng stake weighted oracle network na inilarawan sa ikatlong opsyon ng nakaraang seksyon. Ginagawa ito sa pamamagitan ng pagpapakilala ng tinatawag na TEEs (Trusted Execution Environments). Ang mga TEE ay mga secure na kapaligiran na nakahiwalay sa iba pang bahagi ng system kung saan maaaring isagawa ang sensitibong code. Sa simpleng mga termino, binigyan ng isang programa at isang input, ang mga TEE ay maaaring magsagawa at bumuo ng isang output kasama ng isang patunay. Kung gusto mong matuto pa tungkol sa mga TEE, pakibasa ang [dokumentasyon ng Switchboard](https://docs.switchboard.xyz/functions).

Sa pamamagitan ng pagpapakilala ng mga TEE sa tuktok ng stake weighted oracle, nabe-verify ng Switchboard ang software ng bawat oracle upang payagan ang paglahok sa network. Kung ang isang operator ng oracle ay kumilos nang malisya at magtangkang baguhin ang pagpapatakbo ng naaprubahang code, mabibigo ang isang pag-verify ng quote ng data. Nagbibigay-daan ito sa mga Oracle ng Switchboard na gumana nang lampas sa pag-uulat ng dami ng halaga, gaya ng mga function -- nagpapatakbo ng mga custom at kumpidensyal na pagkalkula sa labas ng chain.

## Switchboard Oracles

Ang mga switchboard oracle ay nag-iimbak ng data sa Solana gamit ang mga feed ng data. Ang mga data feed na ito, na tinatawag ding mga aggregator, ay bawat isa ay isang koleksyon ng mga trabaho na pinagsasama-sama upang makagawa ng isang resulta. Ang mga aggregator na ito ay kinakatawan sa chain bilang isang regular na Solana account na pinamamahalaan ng Switchboard program. Kapag nag-update ang isang oracle, direktang isinusulat nito ang data sa mga account na ito. Tingnan natin ang ilang termino para maunawaan kung paano gumagana ang Switchboard:

- **[Aggregator (Data Feed)](https://github.com/switchboard-xyz/sbv2-solana/blob/0b5e0911a1851f9ca37042e6ff88db4cd840067b/rust/switchboard-solana/src/oracle/_program/acgregrs. * - Naglalaman ng configuration ng feed ng data, na nagdidikta kung paano hinihiling, ina-update, at naresolba ang mga update sa feed ng data onchain mula sa itinalagang pinagmulan nito. Ang Aggregator ay ang account na pagmamay-ari ng Switchboard Solana program at kung saan ang data ay na-publish onchain.
- **[Trabaho](https://github.com/switchboard-xyz/sbv2-solana/blob/0b5e0911a1851f9ca37042e6ff88db4cd840067b/rust/switchboard-solana/src/oracle_program/accounts/job.rs dapat ang bawat data source)** tumutugma sa isang account sa trabaho. Ang account sa trabaho ay isang koleksyon ng mga gawain sa Switchboard na ginagamit upang turuan ang mga orakulo kung paano kumuha at mag-transform ng data. Sa madaling salita, iniimbak nito ang mga blueprint para sa kung paano kinukuha ang data off-chain para sa isang partikular na data source.
- **Oracle** - Isang hiwalay na programa na nasa pagitan ng internet at blockchain at pinapadali ang daloy ng impormasyon. Nagbabasa ang isang orakulo sa mga kahulugan ng trabaho ng isang feed, kinakalkula ang resulta, at isinusumite ang tugon nito onchain.
- **Oracle Queue** - Isang pangkat ng mga orakulo na itatalaga sa pag-update ng mga kahilingan sa round-robin na paraan. Ang mga orakulo sa pila ay dapat na aktibong tumitibok ng puso onchain upang makapagbigay ng mga update. Ang data at mga configuration para sa queue na ito ay naka-store onchain sa isang [account na pagmamay-ari ng Switchboard program](https://github.com/switchboard-xyz/solana-sdk/blob/9dc3df8a5abe261e23d46d14f9e80a7032bb346c/javascript/srcolana. nabuo/oracle-program/accounts/OracleQueueAccountData.ts#L8).
- **Oracle Consensus** - Tinutukoy kung paano nagkakasundo ang mga orakulo sa tinatanggap na onchain na resulta. Ginagamit ng mga switchboard oracle ang median na oracle na tugon bilang tinatanggap na resulta. Maaaring kontrolin ng awtoridad ng feed kung gaano karaming mga orakulo ang hinihiling at kung ilan ang dapat tumugon upang maimpluwensyahan ang seguridad nito.

Ang mga switchboard oracle ay na-insentibo na i-update ang mga feed ng data dahil sila ay ginagantimpalaan para sa paggawa nito nang tumpak. Ang bawat data feed ay may `LeaseContract` account. Ang kontrata sa pag-upa ay isang pre-funded escrow account upang gantimpalaan ang mga orakulo para sa pagtupad sa mga kahilingan sa pag-update. Tanging ang paunang natukoy na `leaseAuthority` ang maaaring mag-withdraw ng mga pondo mula sa kontrata, ngunit kahit sino ay maaaring mag-ambag dito. Kapag humiling ng bagong yugto ng mga update para sa isang data feed, ang user na humiling ng update ay gagantimpalaan mula sa escrow. Ito ay para bigyan ng insentibo ang mga user at crank turners (sinuman na nagpapatakbo ng software para sistematikong magpadala ng mga kahilingan sa pag-update sa Oracles) na panatilihing na-update ang mga feed batay sa mga configuration ng feed. Kapag ang isang kahilingan sa pag-update ay matagumpay na natupad at naisumite nang onchain ng mga orakulo sa pila, ang mga orakulo ay ililipat din ng gantimpala mula sa escrow. Tinitiyak ng mga pagbabayad na ito ang mga aktibong kalahok.

Bukod pa rito, ang mga orakulo ay kailangang mag-stake ng mga token bago sila makapagbigay ng mga kahilingan sa pag-update at magsumite ng mga tugon onchain. Kung ang isang orakulo ay magsusumite ng isang resultang onchain na nasa labas ng mga naka-configure na parameter ng queue, ang kanilang stake ay mababawasan (kung ang queue ay may `slashingEnabled`). Nakakatulong ito na matiyak na ang mga orakulo ay tumutugon nang may mabuting loob na may tumpak na impormasyon.

Ngayong nauunawaan mo na ang terminolohiya at ekonomiya, tingnan natin kung paano na-publish ang data onchain:

1. Oracle queue setup - Kapag ang isang update ay hiniling mula sa isang queue, ang susunod na `N` na oracle ay itatalaga sa kahilingan sa pag-update at umiikot sa likod ng queue. Ang bawat oracle queue sa Switchboard network ay independyente at nagpapanatili ng sarili nitong configuration. Ang configuration ay nakakaimpluwensya sa antas ng seguridad nito. Ang pagpipiliang disenyong ito ay nagbibigay-daan sa mga user na maiangkop ang gawi ng oracle queue upang tumugma sa kanilang partikular na kaso ng paggamit. Ang isang Oracle queue ay naka-imbak onchain bilang isang account at naglalaman ng metadata tungkol sa queue. Ang isang queue ay nagagawa sa pamamagitan ng paggamit ng [oracleQueueInit na pagtuturo](https://github.com/switchboard-xyz/solana-sdk/blob/9dc3df8a5abe261e23d46d14f9e80a7032bb346c/javascript/solana.js/orasrc/cleoratolana. ts#L13) sa programang Switchboard Solana.
     1. Ilang nauugnay na Oracle Queue configuration:
         1. `oracle_timeout` - Ang agwat kapag ang mga lipas na orakulo ay aalisin kung mabigo ang mga ito sa tibok ng puso.
         2. `reward` - Mga reward na magbibigay ng mga orakulo at round openers sa queue na ito.
         3. `min_stake` - Ang pinakamababang halaga ng stake oracle ay dapat ibigay upang manatili sa pila.
         4. `size` - Ang kasalukuyang bilang ng mga orakulo sa isang queue.
         5. `max_size` - Ang maximum na bilang ng mga orakulo na maaaring suportahan ng isang queue.
2. Pag-setup ng aggregator/data feed - Magagawa ang aggregator/feed account. Ang isang feed ay kabilang sa iisang oracle queue. Ang configuration ng feed ay nagdidikta kung paano hinihimok at dinadala sa network ang mga kahilingan sa pag-update.
3. Pag-setup ng Job account - Bilang karagdagan sa feed, dapat na i-set up ang isang job account para sa bawat data source. Tinutukoy nito kung paano matutupad ng mga orakulo ang mga kahilingan sa pag-update ng feed. Kabilang dito ang pagtukoy kung saan dapat kunin ng mga orakulo ang data na hinihiling ng feed.
4. Humiling ng pagtatalaga - Kapag ang isang update ay hiniling sa feed account, ang oracle queue ay magtatalaga ng kahilingan sa iba't ibang oracle/node sa queue upang matupad. Kukunin ng mga orakulo ang data mula sa data source na tinukoy sa bawat account ng trabaho ng feed. Ang bawat account ng trabaho ay may bigat na nauugnay dito. Kakalkulahin ng orakulo ang weighted median ng mga resulta mula sa lahat ng trabaho.
5. Pagkatapos matanggap ang mga tugon ng `minOracleResults`, kinakalkula ng onchain program ang resulta gamit ang median ng mga tugon ng oracle. Ang mga Oracle na tumugon sa loob ng mga naka-configure na parameter ng queue ay ginagantimpalaan, habang ang mga oracle na tumugon sa labas ng threshold na ito ay pina-slash (kung ang queue ay may `slashingEnabled`).
6. Ang na-update na resulta ay naka-imbak sa data feed account upang ito ay mabasa/maubos onchain.

### How to use Switchboard Oracles

Upang magamit ang mga orakulo ng Switchboard at isama ang off-chain na data sa isang Solana program, kailangan mo munang maghanap ng feed na nagbibigay ng data na kailangan mo. Pampubliko ang mga switchboard feed at maraming [available na ang maaari mong pagpilian](https://app.switchboard.xyz/solana/devnet/explore). Kapag naghahanap ng feed, kailangan mong magpasya kung gaano katumpak/kaaasahang gusto mo ang feed, kung saan mo gustong pagmulan ang data, pati na rin ang cadence ng update ng feed. Kapag gumagamit ng feed na available sa publiko, wala kang kontrol sa mga bagay na ito, kaya pumili nang mabuti!

Halimbawa, mayroong Switchboard-sponsored [BTC_USD feed](https://app.switchboard.xyz/solana/devnet/feed/8SXvChNYFhRq4EZuZvnhjrB3jJRQCv4k3P4W6hesH3Ee). Available ang feed na ito sa Solana devnet/mainnet na may pubkey `8SXvChNYFhRq4EZuZvnhjrB3jJRQCv4k3P4W6hesH3Ee`. Nagbibigay ito ng kasalukuyang presyo ng Bitcoin sa USD onchain.

Ang aktwal na onchain na data para sa isang Switchboard feed account ay medyo ganito:

```rust
// from the switchboard solana program
// https://github.com/switchboard-xyz/sbv2-solana/blob/0b5e0911a1851f9ca37042e6ff88db4cd840067b/rust/switchboard-solana/src/oracle_program/accounts/aggregator.rs#L60

pub struct AggregatorAccountData {
    /// Name of the aggregator to store onchain.
    pub name: [u8; 32],
    ...
		...
    /// Pubkey of the queue the aggregator belongs to.
    pub queue_pubkey: Pubkey,
    ...
    /// Minimum number of oracle responses required before a round is validated.
    pub min_oracle_results: u32,
    /// Minimum number of job results before an oracle accepts a result.
    pub min_job_results: u32,
    /// Minimum number of seconds required between aggregator rounds.
    pub min_update_delay_seconds: u32,
    ...
    /// Change percentage required between a previous round and the current round. If variance percentage is not met, reject new oracle responses.
    pub variance_threshold: SwitchboardDecimal,
    ...
		/// Latest confirmed update request result that has been accepted as valid. This is where you will find the data you are requesting in latest_confirmed_round.result
	  pub latest_confirmed_round: AggregatorRound,
		...
    /// The previous confirmed round result.
    pub previous_confirmed_round_result: SwitchboardDecimal,
    /// The slot when the previous confirmed round was opened.
    pub previous_confirmed_round_slot: u64,
		...
}
```

Maaari mong tingnan ang buong code para sa istruktura ng data na ito sa [Switchboard program dito](https://github.com/switchboard-xyz/sbv2-solana/blob/0b5e0911a1851f9ca37042e6ff88db4cd840067b/rust/switchboard-solana/program/srcac/oracle aggregator.rs#L60).

Ang ilang nauugnay na field at configuration sa uri ng `AggregatorAccountData` ay:

- `min_oracle_results` - Minimum na bilang ng mga tugon ng oracle na kinakailangan bago ma-validate ang isang round.
- `min_job_results` - Pinakamababang bilang ng mga resulta ng trabaho bago tumanggap ang isang orakulo ng isang resulta.
- `variance_threshold` - Kinakailangan ang porsyento ng pagbabago sa pagitan ng nakaraang round at kasalukuyang round. Kung hindi natutugunan ang porsyento ng pagkakaiba, tanggihan ang mga bagong tugon ng oracle.
- `latest_confirmed_round` - Pinakabagong nakumpirmang resulta ng kahilingan sa pag-update na tinanggap bilang wasto. Dito mo makikita ang data ng feed sa `latest_confirmed_round.result`
- `min_update_delay_seconds` - Minimum na bilang ng mga segundo na kinakailangan sa pagitan ng aggregator round.

Ang unang tatlong config na nakalista sa itaas ay direktang nauugnay sa katumpakan at pagiging maaasahan ng isang data feed.

Kinakatawan ng field na `min_job_results` ang pinakamababang halaga ng matagumpay na mga tugon mula sa mga pinagmumulan ng data na dapat matanggap ng isang oracle bago nito maisumite ang tugon nito onchain. Ibig sabihin kung ang `min_job_results` ay tatlo, ang bawat orakulo ay kailangang humila mula sa tatlong pinagmumulan ng trabaho. Kung mas mataas ang numerong ito, magiging mas maaasahan at tumpak ang data sa feed. Nililimitahan din nito ang epekto ng isang pinagmumulan ng data sa resulta.

Ang field na `min_oracle_results` ay ang pinakamababang halaga ng mga tugon ng oracle na kinakailangan para maging matagumpay ang isang round. Tandaan, ang bawat orakulo sa isang queue ay kumukuha ng data mula sa bawat pinagmulan na tinukoy bilang isang trabaho. Kinukuha ng orakulo ang weighted median ng mga tugon mula sa mga source at isinusumite ang median na onchain. Pagkatapos ay maghihintay ang program para sa `min_oracle_results` ng mga weighted median at kinukuha ang median niyan, na siyang huling resulta na nakaimbak sa data feed account.

Ang field na `min_update_delay_seconds` ay direktang nauugnay sa cadence ng pag-update ng feed. Ang `min_update_delay_seconds` ay dapat na dumaan sa pagitan ng isang round ng mga update at sa susunod bago ang Switchboard program ay tumanggap ng mga resulta.

Makakatulong na tingnan ang tab ng mga trabaho ng isang feed sa explorer ng Switchboard. Halimbawa, maaari mong tingnan ang [BTC_USD feed sa explorer](https://app.switchboard.xyz/solana/devnet/feed/8SXvChNYFhRq4EZuZvnhjrB3jJRQCv4k3P4W6hesH3Ee). Ang bawat trabahong nakalista ay tumutukoy sa pinagmulan kung saan kukuha ng data ang mga orakulo at ang pagtimbang ng bawat pinagmulan. Maaari mong tingnan ang aktwal na mga endpoint ng API na nagbibigay ng data para sa partikular na feed na ito. Kapag tinutukoy kung anong data feed ang gagamitin sa iyong programa, ang mga bagay na tulad nito ay napakahalagang isaalang-alang.

Nasa ibaba ang screenshot ng dalawa sa mga trabahong nauugnay sa BTC_USD feed. Nagpapakita ito ng dalawang pinagmumulan ng data: [MEXC](https://www.mexc.com/) at [Coinbase](https://www.coinbase.com/).

![Oracle Jobs](../../assets/oracle-jobs.png)

Kapag nakapili ka na ng feed na gagamitin, maaari mong simulang basahin ang data sa feed na iyon. Ginagawa mo ito sa pamamagitan lamang ng pag-deserialize at pagbabasa ng estado na nakaimbak sa account. Ang pinakamadaling paraan upang gawin iyon ay sa pamamagitan ng paggamit ng `AggregatorAccountData` na struct na tinukoy namin sa itaas mula sa `switchboard_v2` crate sa iyong program.

```rust
// import anchor and switchboard crates
use {
    anchor_lang::prelude::*,
    switchboard_v2::AggregatorAccountData,
};

...

#[derive(Accounts)]
pub struct ConsumeDataAccounts<'info> {
	// pass in data feed account and deserialize to AggregatorAccountData
	pub feed_aggregator: AccountLoader<'info, AggregatorAccountData>,
	...
}
```

Pansinin na ginagamit namin ang uri ng `AccountLoader` dito sa halip na ang normal na uri ng `Account` upang i-deserialize ang aggregator account. Dahil sa laki ng `AggregatorAccountData`, ang account ay gumagamit ng tinatawag na zero copy. Ito sa kumbinasyon ng `AccountLoader` ay pumipigil sa account na ma-load sa memorya at sa halip ay nagbibigay sa aming programa ng direktang access sa data. Kapag gumagamit ng `AccountLoader`, maa-access namin ang data na nakaimbak sa account sa isa sa tatlong paraan:

- `load_init` pagkatapos mag-initialize ng account (babalewalain nito ang nawawalang discriminator ng account na idaragdag lamang pagkatapos ng instruction code ng user)
- `load` kapag hindi nababago ang account
- `load_mut` kapag ang account ay nababago

Kung gusto mong matuto pa, tingnan ang [Advance Program Architecture lesson](../program-architecture.md) kung saan hawakan namin ang `Zero-Copy` at `AccountLoader`.

Gamit ang aggregator account na ipinasa sa iyong program, magagamit mo ito para makuha ang pinakabagong resulta ng oracle. Sa partikular, maaari mong gamitin ang paraan ng `get_result()` ng uri:

```rust
// inside an Anchor program
...

let feed = &ctx.accounts.feed_aggregator.load()?;
// get result
let val: f64 = feed.get_result()?.try_into()?;
```

Ang `get_result()` method na tinukoy sa `AggregatorAccountData` struct ay mas ligtas kaysa sa pagkuha ng data gamit ang `latest_confirmed_round.result` dahil ang Switchboard ay nagpatupad ng ilang magagandang pagsusuri sa kaligtasan.

```rust
// from switchboard program
// https://github.com/switchboard-xyz/sbv2-solana/blob/0b5e0911a1851f9ca37042e6ff88db4cd840067b/rust/switchboard-solana/src/oracle_program/accounts/aggregator.rs#L195

pub fn get_result(&self) -> anchor_lang::Result<SwitchboardDecimal> {
    if self.resolution_mode == AggregatorResolutionMode::ModeSlidingResolution {
        return Ok(self.latest_confirmed_round.result);
    }
    let min_oracle_results = self.min_oracle_results;
    let latest_confirmed_round_num_success = self.latest_confirmed_round.num_success;
    if min_oracle_results > latest_confirmed_round_num_success {
        return Err(SwitchboardError::InvalidAggregatorRound.into());
    }
    Ok(self.latest_confirmed_round.result)
}
```

Maaari mo ring tingnan ang kasalukuyang value na nakaimbak sa isang `AggregatorAccountData` account client-side sa Typescript.

```tsx
import { AggregatorAccount, SwitchboardProgram} from '@switchboard-xyz/solana.js'

...
...
// create keypair for test user
let user = new anchor.web3.Keypair()

// fetch switchboard devnet program object
switchboardProgram = await SwitchboardProgram.load(
  "devnet",
  new anchor.web3.Connection("https://api.devnet.solana.com"),
  user
)

// pass switchboard program object and feed pubkey into AggregatorAccount constructor
aggregatorAccount = new AggregatorAccount(switchboardProgram, solUsedSwitchboardFeed)

// fetch latest SOL price
const solPrice: Big | null = await aggregatorAccount.fetchLatestValue()
if (solPrice === null) {
  throw new Error('Aggregator holds no value')
}
```

Tandaan, ang mga feed ng data ng Switchboard ay mga account lamang na ina-update ng mga third party (oracles). Dahil doon, magagawa mo ang anumang bagay gamit ang account na karaniwan mong magagawa sa mga account na nasa labas ng iyong programa.

### Best Practices and Common Pitfalls

Kapag isinasama ang mga feed ng Switchboard sa iyong mga programa, mayroong dalawang grupo ng mga alalahanin na dapat isaalang-alang: pagpili ng feed at aktwal na paggamit ng data mula sa feed na iyon.

Palaging i-audit ang mga configuration ng isang feed bago magpasyang isama ito sa isang programa. Maaaring direktang makaapekto ang mga configuration tulad ng **Min Update Delay**, **Min Resulta ng Trabaho**, at **Min Oracle Resulta** ang data na sa kalaunan ay nananatili sa chain sa aggregator account. Halimbawa, ang pagtingin sa seksyon ng config ng [BTC_USD feed](https://app.switchboard.xyz/solana/devnet/feed/8SXvChNYFhRq4EZuZvnhjrB3jJRQCv4k3P4W6hesH3Ee) makikita mo ang mga nauugnay na configuration nito.

![Oracle Configs](../../assets/oracle-configs.png)

Ang BTC_USD feed ay may Min Update Delay = 6 na segundo. Nangangahulugan ito na ang presyo ng BTC ay ina-update lamang sa minimum na bawat 6 na segundo sa feed na ito. Malamang na mainam ito para sa karamihan ng mga kaso ng paggamit, ngunit kung gusto mong gamitin ang feed na ito para sa isang bagay na sensitibo sa latency, malamang na hindi ito isang magandang pagpipilian.

Kapaki-pakinabang din na i-audit ang mga source ng feed sa seksyong Mga Trabaho ng oracle explorer. Dahil ang value na nananatili sa chain ay ang weighted median na resulta na kinukuha ng mga orakulo mula sa bawat source, direktang naiimpluwensyahan ng mga source kung ano ang nakaimbak sa feed. Tingnan kung may malilim na mga link at potensyal na patakbuhin ang API ng iyong sarili para sa isang oras upang makakuha ng tiwala sa kanila.

Kapag nakahanap ka na ng feed na akma sa iyong mga pangangailangan, kailangan mo pa ring tiyakin na ginagamit mo ang feed nang naaangkop. Halimbawa, dapat mo pa ring ipatupad ang mga kinakailangang pagsusuri sa seguridad sa account na ipinasa sa iyong pagtuturo. Ang anumang account ay maaaring ipasa sa mga tagubilin ng iyong programa, kaya dapat mong i-verify na ito ang account na iyong inaasahan.

Sa Anchor, kung ide-deserialize mo ang account sa uri ng `AggregatorAccountData` mula sa `switchboard_v2` crate, tinitingnan ng Anchor na ang account ay pagmamay-ari ng Switchboard program. Kung inaasahan ng iyong programa na isang partikular na feed ng data lang ang ipapasa sa pagtuturo, maaari mo ring i-verify na ang pampublikong key ng account na ipinasa ay tumutugma sa dapat na ito. Ang isang paraan upang gawin ito ay ang pag-hardcode ng address sa program sa isang lugar at gumamit ng mga hadlang sa account upang i-verify ang address na ipinasa sa mga tumutugma sa inaasahan.

```rust
use {
  anchor_lang::prelude::*,
  solana_program::{pubkey, pubkey::Pubkey},
	switchboard_v2::{AggregatorAccountData},
};

pub static BTC_USDC_FEED: Pubkey = pubkey!("8SXvChNYFhRq4EZuZvnhjrB3jJRQCv4k3P4W6hesH3Ee");

...
...

#[derive(Accounts)]
pub struct TestInstruction<'info> {
	// Switchboard SOL feed aggregator
	#[account(
	    address = BTC_USDC_FEED
	)]
	pub feed_aggregator: AccountLoader<'info, AggregatorAccountData>,
}
```

Bukod sa pagtiyak na ang feed account ang inaasahan mo, maaari ka ring gumawa ng ilang pagsusuri sa data na nakaimbak sa feed sa lohika ng pagtuturo ng iyong programa. Dalawang karaniwang bagay na dapat suriin ay ang data staleness at ang confidence interval.

Ina-update ng bawat feed ng data ang kasalukuyang halaga na nakaimbak dito kapag na-trigger ng mga orakulo. Nangangahulugan ito na ang mga update ay nakadepende sa mga orakulo sa pila kung saan ito nakatalaga. Depende sa kung para saan mo nilalayong gamitin ang data feed, maaaring kapaki-pakinabang na i-verify na ang halagang nakaimbak sa account ay na-update kamakailan. Halimbawa, ang isang protocol sa pagpapautang na kailangang matukoy kung ang collateral ng isang loan ay bumaba sa isang partikular na antas ay maaaring mangailangan ng data na hindi lalampas sa ilang segundo. Maaari mong ipasuri sa iyong code ang timestamp ng pinakabagong update na nakaimbak sa aggregator account. Sinusuri ng sumusunod na snippet ng code na ang timestamp ng pinakabagong update sa feed ng data ay hindi hihigit sa 30 segundo ang nakalipas.

```rust
use {
    anchor_lang::prelude::*,
    anchor_lang::solana_program::clock,
    switchboard_v2::{AggregatorAccountData, SwitchboardDecimal},
};

...
...

let feed = &ctx.accounts.feed_aggregator.load()?;
if (clock::Clock::get().unwrap().unix_timestamp - feed.latest_confirmed_round.round_open_timestamp) <= 30{
      valid_transfer = true;
  }
```

Ang field na `latest_confirmed_round` sa `AggregatorAccountData` struct ay may uri ng `AggregatorRound` na tinukoy bilang:

```rust
// https://github.com/switchboard-xyz/sbv2-solana/blob/0b5e0911a1851f9ca37042e6ff88db4cd840067b/rust/switchboard-solana/src/oracle_program/accounts/aggregator.rs#L17

pub struct AggregatorRound {
    /// Maintains the number of successful responses received from nodes.
    /// Nodes can submit one successful response per round.
    pub num_success: u32,
    /// Number of error responses.
    pub num_error: u32,
    /// Whether an update request round has ended.
    pub is_closed: bool,
    /// Maintains the `solana_program::clock::Slot` that the round was opened at.
    pub round_open_slot: u64,
    /// Maintains the `solana_program::clock::UnixTimestamp;` the round was opened at.
    pub round_open_timestamp: i64,
    /// Maintains the current median of all successful round responses.
    pub result: SwitchboardDecimal,
    /// Standard deviation of the accepted results in the round.
    pub std_deviation: SwitchboardDecimal,
    /// Maintains the minimum node response this round.
    pub min_response: SwitchboardDecimal,
    /// Maintains the maximum node response this round.
    pub max_response: SwitchboardDecimal,
    /// Pubkeys of the oracles fulfilling this round.
    pub oracle_pubkeys_data: [Pubkey; 16],
    /// Represents all successful node responses this round. `NaN` if empty.
    pub medians_data: [SwitchboardDecimal; 16],
    /// Current rewards/slashes oracles have received this round.
    pub current_payout: [i64; 16],
    /// Keep track of which responses are fulfilled here.
    pub medians_fulfilled: [bool; 16],
    /// Keeps track of which errors are fulfilled here.
    pub errors_fulfilled: [bool; 16],
}
```

Mayroong ilang iba pang nauugnay na field na maaaring interesado ka sa Aggregator account tulad ng `num_success`, `medians_data`, `std_deviation`, atbp. Ang `num_success` ay ang bilang ng mga matagumpay na tugon na natanggap mula sa mga oracle sa round na ito ng mga update. Ang `medians_data` ay isang hanay ng lahat ng matagumpay na tugon na natanggap mula sa mga orakulo sa round na ito. Ito ang dataset na ginagamit upang makuha ang median at huling resulta. Ang `std_deviation` ay ang standard deviation ng mga tinatanggap na resulta sa round na ito. Baka gusto mong suriin para sa isang mababang karaniwang paglihis, ibig sabihin na ang lahat ng mga tugon ng orakulo ay magkatulad. Ang switchboard program ay namamahala sa pag-update ng mga nauugnay na field sa struct na ito sa tuwing makakatanggap ito ng update mula sa isang orakulo.


Ang `AggregatorAccountData` ay mayroon ding `check_confidence_interval()` na paraan na maaari mong gamitin bilang isa pang pag-verify sa data na nakaimbak sa feed. Binibigyang-daan ka ng pamamaraan na makapasa sa isang `max_confidence_interval`. Kung ang karaniwang paglihis ng mga resultang natanggap mula sa orakulo ay mas malaki kaysa sa ibinigay na `max_confidence_interval`, nagbabalik ito ng error.

```rust
// https://github.com/switchboard-xyz/sbv2-solana/blob/0b5e0911a1851f9ca37042e6ff88db4cd840067b/rust/switchboard-solana/src/oracle_program/accounts/aggregator.rs#L228

pub fn check_confidence_interval(
    &self,
    max_confidence_interval: SwitchboardDecimal,
) -> anchor_lang::Result<()> {
    if self.latest_confirmed_round.std_deviation > max_confidence_interval {
        return Err(SwitchboardError::ConfidenceIntervalExceeded.into());
    }
    Ok(())
}
```

You can incorporate this into your program like so:

```rust
use {
    crate::{errors::*},
    anchor_lang::prelude::*,
    std::convert::TryInto,
    switchboard_v2::{AggregatorAccountData, SwitchboardDecimal},
};

...
...

let feed = &ctx.accounts.feed_aggregator.load()?;

// check feed does not exceed max_confidence_interval
feed.check_confidence_interval(SwitchboardDecimal::from_f64(max_confidence_interval))
    .map_err(|_| error!(ErrorCode::ConfidenceIntervalExceeded))?;
```

Panghuli, mahalagang magplano para sa mga pinakamasamang sitwasyon sa iyong mga programa. Magplano para sa mga feed na mawawala na at magplano para sa pagsasara ng mga feed account.

## Conclusion

Kung gusto mo ng mga functional na program na maaaring magsagawa ng mga pagkilos batay sa totoong data sa mundo, kakailanganin mong gumamit ng mga orakulo. Sa kabutihang palad, mayroong ilang mapagkakatiwalaang mga network ng orakulo, tulad ng Switchboard, na ginagawang mas madali ang paggamit ng mga orakulo kaysa sa kung hindi man. Gayunpaman, siguraduhing gawin ang iyong angkop na pagsisikap sa mga orakulo na iyong ginagamit. Ikaw ang ganap na responsable para sa pag-uugali ng iyong programa!

# Demo

Magsanay tayo sa paggamit ng orakulo! Bubuo kami ng programang "Michael Burry Escrow" na nagla-lock ng SOL sa isang escrow account hanggang ang SOL ay mas mataas sa isang partikular na halaga ng USD. Ito ay pinangalanan sa mamumuhunan na si [Michael Burry](https://en.wikipedia.org/wiki/Michael_Burry) na sikat sa paghula ng 2008 housing market crash.

Gagamitin namin ang devnet [SOL_USD](https://app.switchboard.xyz/solana/devnet/feed/GvDMxPzN1sCj7L26YDK2HnMRXEQmQ2aemov8YBtPS7vR) oracle mula sa switchboard. Ang programa ay magkakaroon ng dalawang pangunahing tagubilin:

- Deposito - I-lock ang SOL at magtakda ng USD na presyo para i-unlock ito sa.
- Withdraw - Suriin ang USD na presyo at bawiin ang SOL kung ang presyo ay natugunan.

### 1. Program Setup

Upang makapagsimula, gawin natin ang program gamit ang

```zsh
anchor init burry-escrow
```

Susunod, palitan ang program ID sa `lib.rs` at `Anchor.toml` ng program ID na ipinapakita kapag nagpatakbo ka ng `anchor keys list`.

Susunod, idagdag ang sumusunod sa ibaba ng iyong Anchor.toml file. Sasabihin nito sa Anchor kung paano i-configure ang aming lokal na kapaligiran sa pagsubok. Ito ay magpapahintulot sa amin na subukan ang aming programa nang lokal nang hindi kinakailangang mag-deploy at magpadala ng mga transaksyon sa devnet.

```zsh
// bottom of Anchor.toml
[test.validator]
url="https://api.devnet.solana.com"

[test]
startup_wait = 10000

[[test.validator.clone]] # sbv2 devnet programID
address = "SW1TCH7qEPTdLsDHRgPuMQjbQxKdH2aBStViMFnt64f"

[[test.validator.clone]] # sbv2 devnet IDL
address = "Fi8vncGpNKbq62gPo56G4toCehWNy77GgqGkTaAF5Lkk"

[[test.validator.clone]] # sbv2 SOL/USD Feed
address="GvDMxPzN1sCj7L26YDK2HnMRXEQmQ2aemov8YBtPS7vR"
```

Bukod pa rito, gusto naming i-import ang `switchboard-v2` crate sa aming `Cargo.toml` file. Tiyaking ganito ang hitsura ng iyong mga dependency:

```toml
[dependencies]
anchor-lang = "0.28.0"
switchboard-v2 = "0.4.0"
```

Bago tayo magsimula sa lohika, suriin natin ang istruktura ng ating programa. Sa maliliit na programa, napakadaling idagdag ang lahat ng smart contract code sa isang file na `lib.rs` at tawagan ito sa isang araw. Para mapanatili itong mas organisado, makatutulong na hatiin ito sa iba't ibang mga file. Ang aming programa ay magkakaroon ng mga sumusunod na file sa loob ng`programs/src` directory:

`/instructions/deposit.rs`

`/instructions/withdraw.rs`

`/instructions/mod.rs`

`errors.rs`

`state.rs`

`lib.rs`

Ang file na `lib.rs` ay magsisilbi pa rin bilang entry point sa aming programa, ngunit ang lohika para sa bawat pagtuturo ay mapapaloob sa sarili nilang hiwalay na file. Sige at likhain ang arkitektura ng programa na inilarawan sa itaas at magsisimula na tayo.

### 2. `lib.rs`

Bago kami magsulat ng anumang lohika, ise-set up namin ang lahat ng aming impormasyon sa boilerplate. Nagsisimula sa `lib.rs`. Ang aming aktwal na lohika ay mabubuhay sa `/instructions` na direktoryo.

Ang `lib.rs` file ay magsisilbing entrypoint sa aming programa. Tutukuyin nito ang mga endpoint ng API na dapat pagdaanan ng lahat ng transaksyon.

```rust
use anchor_lang::prelude::*;
use instructions::deposit::*;
use instructions::withdraw::*;
use state::*;

pub mod instructions;
pub mod state;
pub mod errors;

declare_id!("YOUR_PROGRAM_KEY_HERE");

#[program]
mod burry_oracle_program {

    use super::*;

    pub fn deposit(ctx: Context<Deposit>, escrow_amt: u64, unlock_price: u64) -> Result<()> {
        deposit_handler(ctx, escrow_amt, unlock_price)
    }

    pub fn withdraw(ctx: Context<Withdraw>) -> Result<()> {
        withdraw_handler(ctx)
    }
}
```

### 3. `state.rs`

Susunod, tukuyin natin ang aming data account para sa program na ito: `EscrowState`. Ang aming data account ay mag-iimbak ng dalawang piraso ng impormasyon:

- `unlock_price` - Ang presyo ng SOL sa USD kung saan maaari kang mag-withdraw; maaari mo itong i-hard-code sa kahit anong gusto mo (hal. $21.53)
- `escrow_amount` - Sinusubaybayan kung ilang lamport ang nakaimbak sa escrow account

Tutukuyin din namin ang aming PDA seed ng `"MICHAEL BURRY"` at ang aming hardcoded na SOL_USD na oracle pubkey na `SOL_USDC_FEED`.

```rust
// in state.rs
use anchor_lang::prelude::*;

pub const ESCROW_SEED: &[u8] = b"MICHAEL BURRY";
pub const SOL_USDC_FEED: &str = "GvDMxPzN1sCj7L26YDK2HnMRXEQmQ2aemov8YBtPS7vR";

#[account]
pub struct EscrowState {
    pub unlock_price: f64,
    pub escrow_amount: u64,
}
```

### 4. Errors

Tukuyin natin ang mga custom na error na gagamitin namin sa buong programa. Sa loob ng `errors.rs` file, i-paste ang sumusunod:

```rust
use anchor_lang::prelude::*;

#[error_code]
#[derive(Eq, PartialEq)]
pub enum EscrowErrorCode {
    #[msg("Not a valid Switchboard account")]
    InvalidSwitchboardAccount,
    #[msg("Switchboard feed has not been updated in 5 minutes")]
    StaleFeed,
    #[msg("Switchboard feed exceeded provided confidence interval")]
    ConfidenceIntervalExceeded,
    #[msg("Current SOL price is not above Escrow unlock price.")]
    SolPriceAboveUnlockPrice,
}
```

### 5. `mod.rs`

Let's set up our `instructions/mod.rs` file.

```rust
// inside mod.rs
pub mod deposit;
pub mod withdraw;
```

### 6. **Deposit**

Ngayong wala na tayong lahat ng boilerplate, lumipat tayo sa aming pagtuturo sa Deposito. Ito ay mabubuhay sa `/src/instructions/deposit.rs` file. Kapag nagdeposito ang isang user, dapat gumawa ng PDA gamit ang string na "MICHAEL BURRY" at ang pubkey ng user bilang mga buto. Ito ay likas na nangangahulugan na ang isang user ay maaari lamang magbukas ng isang escrow account sa isang pagkakataon. Ang pagtuturo ay dapat magpasimula ng isang account sa PDA na ito at ipadala ang halaga ng SOL na gustong i-lock ng user dito. Ang gumagamit ay kailangang maging isang pumirma.

Buuin muna natin ang struct ng Konteksto ng Deposito. Para magawa iyon, kailangan nating isipin kung anong mga account ang kakailanganin para sa pagtuturong ito. Magsisimula tayo sa mga sumusunod:

```rust
//inside deposit.rs
use crate::state::*;
use anchor_lang::prelude::*;
use anchor_lang::solana_program::{
    system_instruction::transfer,
    program::invoke
};

#[derive(Accounts)]
pub struct Deposit<'info> {
    // user account
    #[account(mut)]
    pub user: Signer<'info>,
    #[account(
      init,
      seeds = [ESCROW_SEED, user.key().as_ref()],
      bump,
      payer = user,
      space = std::mem::size_of::<EscrowState>() + 8
    )]
    pub escrow_account: Account<'info, EscrowState>,
		// system program
    pub system_program: Program<'info, System>,
}
```

Pansinin ang mga hadlang na idinagdag namin sa mga account:
- Dahil ililipat namin ang SOL mula sa User account patungo sa `escrow_state` account, kailangan nilang pareho na ma-mutable.
- Alam namin na ang `escrow_account` ay dapat ay isang PDA na nagmula sa string na "MICHAEL BURRY" at pubkey ng user. Maaari naming gamitin ang mga hadlang sa Anchor account upang matiyak na ang address na ipinasa ay aktwal na nakakatugon sa kinakailangang iyon.
- Alam din namin na kailangan naming simulan ang isang account sa PDA na ito upang mag-imbak ng ilang estado para sa programa. Ginagamit namin ang `init` constraint dito.

Lumipat tayo sa aktwal na lohika. Ang kailangan lang nating gawin ay simulan ang estado ng `escrow_state` account at ilipat ang SOL. Inaasahan namin na ipapasa ng user ang halaga ng SOL na gusto nilang i-lock sa escrow at ang presyo para ma-unlock ito. Iimbak namin ang mga halagang ito sa `escrow_state` account.

Pagkatapos nito, dapat isagawa ng pamamaraan ang paglilipat. Ila-lock ng program na ito ang katutubong SOL. Dahil dito, hindi namin kailangang gumamit ng mga token account o ang Solana token program. Kakailanganin nating gamitin ang `system_program` upang ilipat ang mga lampor na gustong i-lock ng user sa escrow at ipatupad ang pagtuturo sa paglilipat.

```rust
pub fn deposit_handler(ctx: Context<Deposit>, escrow_amt: u64, unlock_price: u64) -> Result<()> {
		msg!("Depositing funds in escrow...");

    let escrow_state = &mut ctx.accounts.escrow_account;
    escrow_state.unlock_price = unlock_price;
    escrow_state.escrow_amount = escrow_amount;

    let transfer_ix = transfer(
      &ctx.accounts.user.key(),
      &escrow_state.key(),
      escrow_amount
    );

    invoke(
        &transfer_ix,
        &[
            ctx.accounts.user.to_account_info(),
            ctx.accounts.escrow_account.to_account_info(),
            ctx.accounts.system_program.to_account_info()
        ]
    )?;

    msg!("Transfer complete. Escrow will unlock SOL at {}", &ctx.accounts.escrow_account.unlock_price);
}
```

Iyan ang buod ng pagtuturo ng deposito! Ang huling resulta ng `deposit.rs` file ay dapat magmukhang ganito:

```rust
use crate::state::*;
use anchor_lang::prelude::*;
use anchor_lang::solana_program::{
    system_instruction::transfer,
    program::invoke
};

pub fn deposit_handler(ctx: Context<Deposit>, escrow_amount: u64, unlock_price: f64) -> Result<()> {
    msg!("Depositing funds in escrow...");

    let escrow_state = &mut ctx.accounts.escrow_account;
    escrow_state.unlock_price = unlock_price;
    escrow_state.escrow_amount = escrow_amount;

    let transfer_ix = transfer(
        &ctx.accounts.user.key(),
        &escrow_state.key(),
        escrow_amount
    );

    invoke(
        &transfer_ix,
        &[
            ctx.accounts.user.to_account_info(),
            ctx.accounts.escrow_account.to_account_info(),
            ctx.accounts.system_program.to_account_info()
        ]
    )?;

    msg!("Transfer complete. Escrow will unlock SOL at {}", &ctx.accounts.escrow_account.unlock_price);

    Ok(())
}

#[derive(Accounts)]
pub struct Deposit<'info> {
    // user account
    #[account(mut)]
    pub user: Signer<'info>,
    // account to store SOL in escrow
    #[account(
        init,
        seeds = [ESCROW_SEED, user.key().as_ref()],
        bump,
        payer = user,
        space = std::mem::size_of::<EscrowState>() + 8
    )]
    pub escrow_account: Account<'info, EscrowState>,

    pub system_program: Program<'info, System>,
}
```

**Withdraw**

Ang tagubilin sa pag-withdraw ay mangangailangan ng parehong tatlong account gaya ng pagtuturo ng deposito kasama ang SOL_USDC Switchboard feed account. Mapupunta ang code na ito sa `withdraw.rs` file.

```rust
use crate::state::*;
use crate::errors::*;
use std::str::FromStr;
use anchor_lang::prelude::*;
use switchboard_v2::AggregatorAccountData;
use anchor_lang::solana_program::clock::Clock;

#[derive(Accounts)]
pub struct Withdraw<'info> {
    // user account
    #[account(mut)]
    pub user: Signer<'info>,
    // escrow account
    #[account(
        mut,
        seeds = [ESCROW_SEED, user.key().as_ref()],
        bump,
        close = user
    )]
    pub escrow_account: Account<'info, EscrowState>,
    // Switchboard SOL feed aggregator
    #[account(
        address = Pubkey::from_str(SOL_USDC_FEED).unwrap()
    )]
    pub feed_aggregator: AccountLoader<'info, AggregatorAccountData>,
    pub system_program: Program<'info, System>,
}
```

Pansinin na ginagamit namin ang malapit na hadlang dahil sa sandaling makumpleto ang transaksyon, gusto naming isara ang `escrow_account`. Ang SOL na ginamit bilang upa sa account ay ililipat sa user account.

Ginagamit din namin ang mga hadlang sa address upang i-verify na ang feed account na ipinasa ay talagang ang feed na `usdc_sol` at hindi ang ibang feed (mayroon kaming naka-hard code na SOL_USDC_FEED address). Bilang karagdagan, ang AggregatorAccountData struct na aming deserialize ay mula sa Switchboard rust crate. Bine-verify nito na ang ibinigay na account ay pagmamay-ari ng switchboard program at nagbibigay-daan sa amin na madaling tingnan ang mga halaga nito. Mapapansin mong nakabalot ito sa isang `AccountLoader`. Ito ay dahil ang feed ay talagang isang medyo malaking account at kailangan itong maging zero na kopya.

Ngayon ay ipatupad natin ang lohika ng pagtuturo ng pag-withdraw. Una, tinitingnan namin kung ang feed ay lipas na. Pagkatapos ay kinukuha namin ang kasalukuyang presyo ng SOL na nakaimbak sa `feed_aggregator` account. Panghuli, gusto naming tingnan kung ang kasalukuyang presyo ay mas mataas sa escrow `unlock_price`. Kung ito ay, pagkatapos ay ilipat namin ang SOL mula sa escrow account pabalik sa user at isara ang account. Kung hindi, dapat matapos ang pagtuturo at magbalik ng error.

```rust
pub fn withdraw_handler(ctx: Context<Withdraw>, params: WithdrawParams) -> Result<()> {
    let feed = &ctx.accounts.feed_aggregator.load()?;
    let escrow_state = &ctx.accounts.escrow_account;

    // get result
    let val: f64 = feed.get_result()?.try_into()?;

    // check whether the feed has been updated in the last 300 seconds
    feed.check_staleness(Clock::get().unwrap().unix_timestamp, 300)
    .map_err(|_| error!(EscrowErrorCode::StaleFeed))?;

    msg!("Current feed result is {}!", val);
    msg!("Unlock price is {}", escrow_state.unlock_price);

    if val < escrow_state.unlock_price as f64 {
        return Err(EscrowErrorCode::SolPriceAboveUnlockPrice.into())
    }

	....
}
```

Upang tapusin ang lohika, isasagawa namin ang paglipat, sa pagkakataong ito kailangan naming ilipat ang mga pondo sa ibang paraan. Dahil naglilipat kami mula sa isang account na naglalaman din ng data, hindi namin magagamit ang paraan ng `system_program::transfer` tulad ng dati. Kung susubukan namin, ang pagtuturo ay mabibigo na maisakatuparan sa sumusunod na error.

```zsh
'Transfer: `from` must not carry data'
```

Upang maisaalang-alang ito, gagamitin namin ang `try_borrow_mut_lamports()` sa bawat account at idagdag/babawas ang halaga ng mga lampor na nakaimbak sa bawat account.

```rust
// 'Transfer: `from` must not carry data'
  **escrow_state.to_account_info().try_borrow_mut_lamports()? = escrow_state
      .to_account_info()
      .lamports()
      .checked_sub(escrow_state.escrow_amount)
      .ok_or(ProgramError::InvalidArgument)?;

  **ctx.accounts.user.to_account_info().try_borrow_mut_lamports()? = ctx.accounts.user
      .to_account_info()
      .lamports()
      .checked_add(escrow_state.escrow_amount)
      .ok_or(ProgramError::InvalidArgument)?;
```

Ang huling paraan ng pag-withdraw sa file na `withdraw.rs` ay dapat magmukhang ganito:

```rust
use crate::state::*;
use crate::errors::*;
use std::str::FromStr;
use anchor_lang::prelude::*;
use switchboard_v2::AggregatorAccountData;
use anchor_lang::solana_program::clock::Clock;

pub fn withdraw_handler(ctx: Context<Withdraw>) -> Result<()> {
    let feed = &ctx.accounts.feed_aggregator.load()?;
    let escrow_state = &ctx.accounts.escrow_account;

    // get result
    let val: f64 = feed.get_result()?.try_into()?;

    // check whether the feed has been updated in the last 300 seconds
    feed.check_staleness(Clock::get().unwrap().unix_timestamp, 300)
    .map_err(|_| error!(EscrowErrorCode::StaleFeed))?;

    msg!("Current feed result is {}!", val);
    msg!("Unlock price is {}", escrow_state.unlock_price);

    if val < escrow_state.unlock_price as f64 {
        return Err(EscrowErrorCode::SolPriceAboveUnlockPrice.into())
    }

    // 'Transfer: `from` must not carry data'
    **escrow_state.to_account_info().try_borrow_mut_lamports()? = escrow_state
        .to_account_info()
        .lamports()
        .checked_sub(escrow_state.escrow_amount)
        .ok_or(ProgramError::InvalidArgument)?;

    **ctx.accounts.user.to_account_info().try_borrow_mut_lamports()? = ctx.accounts.user
        .to_account_info()
        .lamports()
        .checked_add(escrow_state.escrow_amount)
        .ok_or(ProgramError::InvalidArgument)?;

    Ok(())
}

#[derive(Accounts)]
pub struct Withdraw<'info> {
    // user account
    #[account(mut)]
    pub user: Signer<'info>,
    // escrow account
    #[account(
        mut,
        seeds = [ESCROW_SEED, user.key().as_ref()],
        bump,
        close = user
    )]
    pub escrow_account: Account<'info, EscrowState>,
    // Switchboard SOL feed aggregator
    #[account(
        address = Pubkey::from_str(SOL_USDC_FEED).unwrap()
    )]
    pub feed_aggregator: AccountLoader<'info, AggregatorAccountData>,
    pub system_program: Program<'info, System>,
}
```

At iyan para sa programa! Sa puntong ito, dapat mong patakbuhin ang `anchor build` nang walang anumang mga error.

Tandaan: kung makakita ka ng error tulad ng ipinakita sa ibaba, maaari mong ligtas na balewalain ito.

```bash
Compiling switchboard-v2 v0.4.0
Error: Function _ZN86_$LT$switchboard_v2..aggregator..AggregatorAccountData$u20$as$u20$core..fmt..Debug$GT$3fmt17hea9f7644392c2647E Stack offset of 4128 exceeded max offset of 4096 by 32 bytes, please minimize large stack variables
```

### 7. Testing

Sumulat tayo ng ilang pagsubok. Dapat tayong apat sa kanila:

- Paglikha ng Escrow na may presyo ng pag-unlock ***sa ibaba*** ng kasalukuyang presyo ng Sol para masubukan namin ang pag-withdraw nito
- Pag-withdraw at pagsasara mula sa itaas na escrow
- Paglikha ng Escrow na may presyo sa pag-unlock ***sa itaas*** ng kasalukuyang presyo ng Sol para masubukan namin ang pag-withdraw nito
- Pag-withdraw at pagbagsak mula sa escrow sa itaas

Tandaan na maaari lamang magkaroon ng isang escrow bawat user, kaya mahalaga ang order sa itaas.

Ibibigay namin ang lahat ng testing code sa isang snippet. Suriin upang matiyak na naiintindihan mo ito bago patakbuhin ang `anchor test`.

```typescript
// tests/burry-escrow.ts

import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { BurryEscrow } from "../target/types/burry_escrow";
import { Big } from "@switchboard-xyz/common";
import { AggregatorAccount, AnchorWallet, SwitchboardProgram } from "@switchboard-xyz/solana.js"
import { assert } from "chai";

export const solUsedSwitchboardFeed = new anchor.web3.PublicKey("GvDMxPzN1sCj7L26YDK2HnMRXEQmQ2aemov8YBtPS7vR")

describe("burry-escrow", () => {
  // Configure the client to use the local cluster.
  anchor.setProvider(anchor.AnchorProvider.env());
  const provider = anchor.AnchorProvider.env()
  const program = anchor.workspace.BurryEscrow as Program<BurryEscrow>;
  const payer = (provider.wallet as AnchorWallet).payer

  it("Create Burry Escrow Below Price", async () => {
    // fetch switchboard devnet program object
    const switchboardProgram = await SwitchboardProgram.load(
      "devnet",
      new anchor.web3.Connection("https://api.devnet.solana.com"),
      payer
    )
    const aggregatorAccount = new AggregatorAccount(switchboardProgram, solUsedSwitchboardFeed)

    // derive escrow state account
    const [escrowState] = await anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("MICHAEL BURRY"), payer.publicKey.toBuffer()],
      program.programId
    )

    // fetch latest SOL price
    const solPrice: Big | null = await aggregatorAccount.fetchLatestValue()
    if (solPrice === null) {
      throw new Error('Aggregator holds no value')
    }
    const failUnlockPrice = solPrice.minus(10).toNumber()
    const amountToLockUp = new anchor.BN(100)

    // Send transaction
    try {
      const tx = await program.methods.deposit(
        amountToLockUp, 
        failUnlockPrice
      )
      .accounts({
        user: payer.publicKey,
        escrowAccount: escrowState,
        systemProgram: anchor.web3.SystemProgram.programId
      })
      .signers([payer])
      .rpc()

      await provider.connection.confirmTransaction(tx, "confirmed")

      // Fetch the created account
      const newAccount = await program.account.escrowState.fetch(
        escrowState
      )

      const escrowBalance = await provider.connection.getBalance(escrowState, "confirmed")
      console.log("Onchain unlock price:", newAccount.unlockPrice)
      console.log("Amount in escrow:", escrowBalance)

      // Check whether the data onchain is equal to local 'data'
      assert(failUnlockPrice == newAccount.unlockPrice)
      assert(escrowBalance > 0)
    } catch (e) {
      console.log(e)
      assert.fail(e)
    }
  })

  it("Withdraw from escrow", async () => {
    // derive escrow address
    const [escrowState] = await anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("MICHAEL BURRY"), payer.publicKey.toBuffer()],
      program.programId
    )
    
    // send tx
    const tx = await program.methods.withdraw()
    .accounts({
      user: payer.publicKey,
      escrowAccount: escrowState,
      feedAggregator: solUsedSwitchboardFeed,
      systemProgram: anchor.web3.SystemProgram.programId
  })
    .signers([payer])
    .rpc()

    await provider.connection.confirmTransaction(tx, "confirmed")

    // assert that the escrow account has been closed
    let accountFetchDidFail = false;
    try {
      await program.account.escrowState.fetch(escrowState)
    } catch(e){
      accountFetchDidFail = true;
    }

    assert(accountFetchDidFail)
 
  })

  it("Create Burry Escrow Above Price", async () => {
    // fetch switchboard devnet program object
    const switchboardProgram = await SwitchboardProgram.load(
      "devnet",
      new anchor.web3.Connection("https://api.devnet.solana.com"),
      payer
    )
    const aggregatorAccount = new AggregatorAccount(switchboardProgram, solUsedSwitchboardFeed)

    // derive escrow state account
    const [escrowState] = await anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("MICHAEL BURRY"), payer.publicKey.toBuffer()],
      program.programId
    )
    console.log("Escrow Account: ", escrowState.toBase58())

    // fetch latest SOL price
    const solPrice: Big | null = await aggregatorAccount.fetchLatestValue()
    if (solPrice === null) {
      throw new Error('Aggregator holds no value')
    }
    const failUnlockPrice = solPrice.plus(10).toNumber()
    const amountToLockUp = new anchor.BN(100)

    // Send transaction
    try {
      const tx = await program.methods.deposit(
        amountToLockUp, 
        failUnlockPrice
      )
      .accounts({
        user: payer.publicKey,
        escrowAccount: escrowState,
        systemProgram: anchor.web3.SystemProgram.programId
      })
      .signers([payer])
      .rpc()

      await provider.connection.confirmTransaction(tx, "confirmed")
      console.log("Your transaction signature", tx)

      // Fetch the created account
      const newAccount = await program.account.escrowState.fetch(
        escrowState
      )

      const escrowBalance = await provider.connection.getBalance(escrowState, "confirmed")
      console.log("Onchain unlock price:", newAccount.unlockPrice)
      console.log("Amount in escrow:", escrowBalance)

      // Check whether the data onchain is equal to local 'data'
      assert(failUnlockPrice == newAccount.unlockPrice)
      assert(escrowBalance > 0)
    } catch (e) {
      console.log(e)
      assert.fail(e)
    }
  })

  it("Attempt to withdraw while price is below UnlockPrice", async () => {
    let didFail = false;

    // derive escrow address
    const [escrowState] = await anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("MICHAEL BURRY"), payer.publicKey.toBuffer()],
      program.programId
    )
    
    // send tx
    try {
      const tx = await program.methods.withdraw()
      .accounts({
        user: payer.publicKey,
        escrowAccount: escrowState,
        feedAggregator: solUsedSwitchboardFeed,
        systemProgram: anchor.web3.SystemProgram.programId
    })
      .signers([payer])
      .rpc()

      await provider.connection.confirmTransaction(tx, "confirmed")
      console.log("Your transaction signature", tx)

    } catch (e) {
      // verify tx returns expected error
      didFail = true;
      console.log(e.error.errorMessage)
      assert(e.error.errorMessage == 'Current SOL price is not above Escrow unlock price.')
    }

    assert(didFail)
  })
});
```

Kung nakakaramdam ka ng tiwala sa lohika ng pagsubok, magpatuloy at patakbuhin ang `anchor test` sa iyong napiling shell. Dapat kang makakuha ng apat na pagpasa sa mga pagsusulit.

Kung may nangyaring mali, bumalik sa demo at tiyaking nakuha mo ang lahat ng tama. Bigyang-pansin ang layunin sa likod ng code sa halip na kopyahin/i-paste lamang. Huwag mag-atubiling suriin din ang gumaganang code [sa `pangunahing` branch ng repositoryo ng Github nito](https://github.com/Unboxed-Software/michael-burry-escrow).

## Hamon

Bilang isang independiyenteng hamon, gumawa ng fallback plan kung bumababa ang data feed. Kung hindi na-update ng Oracle queue ang aggregator account sa X time o kung wala na ang data feed account, bawiin ang escrowed na pondo ng user.

Ang isang potensyal na solusyon sa hamon na ito ay matatagpuan [sa Github repository sa `challenge-solution` branch](https://github.com/Unboxed-Software/michael-burry-escrow/tree/challenge-solution).