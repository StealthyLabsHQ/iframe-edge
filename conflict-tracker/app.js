(() => {
    "use strict";

    const $ = id => document.getElementById(id);
    const THEME_KEY = "pa_theme";
    const LANG_KEY = "pa_lang";
    const FETCH_TIMEOUT = 12000;

    /* ══════════════════════════════════════════════════════════════════
     *  EVENT TYPES
     * ═════════════════════════════════════════════════════════════════*/
    const TYPES = {
        combat: { color: "#ff2d55", fr: "Combats", en: "Combat" },
        missile: { color: "#ff6b35", fr: "Missiles / Frappes", en: "Missiles / Strikes" },
        airstrike: { color: "#fbbf24", fr: "Frappes aériennes", en: "Airstrikes" },
        naval: { color: "#22d3ee", fr: "Incidents navals", en: "Naval Incidents" },
        troops: { color: "#34d399", fr: "Mouvements troupes", en: "Troop Movements" },
        humanitarian: { color: "#a855f7", fr: "Crise humanitaire", en: "Humanitarian Crisis" },
        tension: { color: "#3b82f6", fr: "Tensions", en: "Tensions" },
    };

    /* ══════════════════════════════════════════════════════════════════
     *  INTELLIGENCE CONTEXT — per region
     *  Each entry has FR + EN summaries shown in the detail panel
     * ═════════════════════════════════════════════════════════════════*/
    const INTEL = {
        "Ukraine": {
            fr: "La guerre russo-ukrainienne se poursuit avec des combats intenses le long de la ligne de front du Donbas. La Russie poursuit ses campagnes de missiles et de drones Shahed contre les infrastructures énergétiques et civiles ukrainiennes. L'armée ukrainienne maintient des contre-offensives dans la région de Kursk. Les livraisons d'armes occidentales restent un facteur clé.",
            en: "The Russo-Ukrainian war continues with intense fighting along the Donbas front line. Russia maintains cruise missile and Shahed drone campaigns targeting Ukrainian energy and civilian infrastructure. Ukraine sustains counter-offensives in the Kursk region. Western weapons deliveries remain a key factor.",
        },
        "Russia/Ukraine": {
            fr: "L'offensive ukrainienne dans la région de Kursk représente une incursion sur le sol russe, avec des combats actifs autour de Sudzha. La Russie a renforcé ses défenses et déployé des troupes nord-coréennes selon les rapports.",
            en: "The Ukrainian offensive in Kursk region represents an incursion on Russian soil, with active combat around Sudzha. Russia has reinforced defenses and reportedly deployed North Korean troops.",
        },
        "Crimea": {
            fr: "La péninsule de Crimée fait face à des frappes ukrainiennes régulières contre les bases navales et aériennes russes, notamment Sébastopol. La flotte russe de la mer Noire a subi des pertes significatives.",
            en: "The Crimean peninsula faces regular Ukrainian strikes on Russian naval and air bases, particularly Sevastopol. Russia's Black Sea Fleet has suffered significant losses.",
        },
        "Black Sea": {
            fr: "La mer Noire est une zone d'opérations navales actives. L'Ukraine utilise des drones navals pour cibler les navires russes. Le corridor céréalier reste un enjeu stratégique.",
            en: "The Black Sea is an active naval operations zone. Ukraine uses naval drones to target Russian vessels. The grain corridor remains a strategic issue.",
        },
        "Gaza": {
            fr: "Le conflit israélo-palestinien à Gaza a atteint des niveaux critiques. L'offensive terrestre israélienne poursuit ses opérations urbaines à travers la bande de Gaza. La crise humanitaire est catastrophique avec des déplacements massifs de population, des pénuries alimentaires et médicales sévères.",
            en: "The Israeli-Palestinian conflict in Gaza has reached critical levels. Israel's ground offensive continues urban operations throughout the Gaza Strip. The humanitarian crisis is catastrophic with massive population displacement, severe food and medical shortages.",
        },
        "West Bank": {
            fr: "La Cisjordanie connaît des raids militaires israéliens fréquents dans les camps de réfugiés et les villes palestiniennes. La violence des colons est en hausse. Les tensions sont au plus haut depuis des décennies.",
            en: "The West Bank experiences frequent Israeli military raids in refugee camps and Palestinian cities. Settler violence is rising. Tensions are at their highest in decades.",
        },
        "Golan Heights": {
            fr: "Les hauteurs du Golan sont une zone tampon entre Israël et la Syrie. Des échanges de tirs occasionnels ont lieu avec le Hezbollah. Israël surveille les mouvements iraniens en Syrie.",
            en: "The Golan Heights serve as a buffer zone between Israel and Syria. Occasional exchanges of fire occur with Hezbollah. Israel monitors Iranian movements in Syria.",
        },
        "Lebanon": {
            fr: "Le sud du Liban est le théâtre d'échanges de tirs quotidiens entre Israël et le Hezbollah. Des frappes israéliennes ciblent les positions du Hezbollah à Beyrouth et dans la vallée de la Bekaa. Le Hezbollah riposte avec des roquettes et des drones.",
            en: "Southern Lebanon witnesses daily exchanges of fire between Israel and Hezbollah. Israeli strikes target Hezbollah positions in Beirut and the Bekaa Valley. Hezbollah retaliates with rockets and drones.",
        },
        "Yemen": {
            fr: "Les Houthis, soutenus par l'Iran, poursuivent leurs attaques contre le trafic maritime en mer Rouge en solidarité avec Gaza. La coalition menée par les États-Unis riposte avec des frappes sur Sanaa et Hodeida. La crise humanitaire reste l'une des pires au monde.",
            en: "Iran-backed Houthis continue attacks on maritime traffic in the Red Sea in solidarity with Gaza. The US-led coalition retaliates with strikes on Sanaa and Hodeida. The humanitarian crisis remains one of the worst in the world.",
        },
        "Red Sea": {
            fr: "La mer Rouge est devenue une zone de conflit naval actif. Les attaques houthies contre les navires commerciaux perturbent le commerce mondial. Les forces navales occidentales patrouillent le détroit de Bab el-Mandeb.",
            en: "The Red Sea has become an active naval conflict zone. Houthi attacks on commercial shipping disrupt global trade. Western naval forces patrol the Bab el-Mandeb strait.",
        },
        "Syria": {
            fr: "La Syrie reste fragmentée entre le régime, les forces kurdes (FDS), et diverses milices. Les frappes aériennes russes et les opérations turques se poursuivent. La présence militaire américaine à Al-Tanf est régulièrement ciblée par des milices pro-iraniennes.",
            en: "Syria remains fragmented between the regime, Kurdish forces (SDF), and various militias. Russian airstrikes and Turkish operations continue. The US military presence at Al-Tanf is regularly targeted by pro-Iranian militias.",
        },
        "Sudan": {
            fr: "Le conflit entre l'armée soudanaise (SAF) et les Forces de Soutien Rapide (RSF) a plongé le pays dans une guerre civile dévastatrice. Khartoum est un champ de bataille urbain. Le Darfour subit des violences ethniques massives. Plus de 10 millions de déplacés.",
            en: "The conflict between the Sudanese army (SAF) and Rapid Support Forces (RSF) has plunged the country into a devastating civil war. Khartoum is an urban battlefield. Darfur suffers massive ethnic violence. Over 10 million displaced.",
        },
        "Sudan/Chad": {
            fr: "La frontière Soudan-Tchad fait face à un afflux massif de réfugiés fuyant les combats au Darfour. Les camps de réfugiés sont débordés. L'aide humanitaire peine à atteindre les populations.",
            en: "The Sudan-Chad border faces a massive influx of refugees fleeing fighting in Darfur. Refugee camps are overwhelmed. Humanitarian aid struggles to reach populations.",
        },
        "DR Congo": {
            fr: "L'est de la RDC est en proie à la violence du M23, soutenu par le Rwanda, et de dizaines d'autres groupes armés. Goma est menacée. L'ADF (affiliée à l'EI) opère dans l'Ituri. Des millions de déplacés internes.",
            en: "Eastern DRC is plagued by violence from the Rwanda-backed M23 and dozens of other armed groups. Goma is threatened. The ADF (IS affiliate) operates in Ituri. Millions internally displaced.",
        },
        "Myanmar": {
            fr: "La résistance armée contre la junte militaire s'intensifie sur tous les fronts. L'Armée d'Arakan contrôle une grande partie du Rakhine. Les Forces de Défense du Peuple progressent. La junte recourt aux frappes aériennes contre les populations civiles.",
            en: "Armed resistance against the military junta intensifies on all fronts. The Arakan Army controls much of Rakhine. People's Defense Forces advance. The junta resorts to airstrikes against civilian populations.",
        },
        "Mali": {
            fr: "Le Mali fait face à l'insurrection jihadiste du JNIM (lié à al-Qaïda) et de l'EIGS (affilié à l'EI). Le retrait des forces françaises et de la MINUSMA a été suivi par l'arrivée de Wagner/Africa Corps. L'instabilité s'étend.",
            en: "Mali faces the jihadist insurgency of JNIM (al-Qaeda linked) and ISGS (IS affiliate). The withdrawal of French forces and MINUSMA has been followed by Wagner/Africa Corps arrival. Instability spreads.",
        },
        "Burkina Faso": {
            fr: "Le Burkina Faso subit l'une des insurrections jihadistes les plus meurtrières du Sahel. Plus de 40% du territoire échappe au contrôle de l'État. Les massacres de civils sont fréquents. La junte militaire a fait appel à des mercenaires russes.",
            en: "Burkina Faso suffers one of the deadliest jihadist insurgencies in the Sahel. Over 40% of territory is beyond state control. Civilian massacres are frequent. The military junta has enlisted Russian mercenaries.",
        },
        "Nigeria": {
            fr: "Le nord-est du Nigeria reste en proie à l'insurrection de Boko Haram et de l'ISWAP. Les attaques contre les bases militaires et les civils persistent. Le banditisme armé dans le nord-ouest ajoute à l'instabilité.",
            en: "Northeastern Nigeria remains plagued by the Boko Haram and ISWAP insurgency. Attacks on military bases and civilians persist. Armed banditry in the northwest adds to instability.",
        },
        "Niger": {
            fr: "Le Niger, dirigé par une junte militaire depuis 2023, fait face à des incursions jihadistes à ses frontières. Les relations avec les partenaires occidentaux se sont détériorées au profit de la Russie.",
            en: "Niger, governed by a military junta since 2023, faces jihadist incursions at its borders. Relations with Western partners have deteriorated in favor of Russia.",
        },
        "Somalia": {
            fr: "Al-Shabaab reste une menace majeure en Somalie, menant des attaques régulières contre les forces gouvernementales et l'AMISOM. Le groupe contrôle encore de vastes zones rurales. Les frappes américaines de drones continuent.",
            en: "Al-Shabaab remains a major threat in Somalia, conducting regular attacks against government forces and AMISOM. The group still controls vast rural areas. US drone strikes continue.",
        },
        "Ethiopia": {
            fr: "Après la guerre du Tigré, l'instabilité s'est déplacée vers la région Amhara où les milices Fano s'opposent aux forces fédérales. Les tensions ethniques persistent dans plusieurs régions.",
            en: "After the Tigray war, instability has shifted to the Amhara region where Fano militias oppose federal forces. Ethnic tensions persist across several regions.",
        },
        "Mozambique": {
            fr: "L'insurrection islamiste dans la province de Cabo Delgado se poursuit malgré le soutien militaire rwandais et de la SADC. Les attaques contre les villages et les infrastructures gazières persistent.",
            en: "The Islamist insurgency in Cabo Delgado province continues despite Rwandan and SADC military support. Attacks on villages and gas infrastructure persist.",
        },
        "Taiwan Strait": {
            fr: "Les tensions à travers le détroit de Taiwan restent élevées. La Chine mène des exercices militaires de grande envergure. Les survols de la zone d'identification de défense aérienne taïwanaise sont quasi quotidiens. Les États-Unis maintiennent une posture de dissuasion.",
            en: "Tensions across the Taiwan Strait remain elevated. China conducts large-scale military exercises. Flights into Taiwan's air defense identification zone are near-daily. The US maintains a deterrence posture.",
        },
        "South China Sea": {
            fr: "La mer de Chine méridionale est le théâtre de confrontations navales entre la Chine et les Philippines, notamment autour du récif de Scarborough et des îles Spratly. Les patrouilles américaines de liberté de navigation se poursuivent.",
            en: "The South China Sea is the scene of naval confrontations between China and the Philippines, particularly around Scarborough Shoal and the Spratly Islands. US freedom of navigation patrols continue.",
        },
        "Philippines": {
            fr: "Les Philippines font face à des incidents maritimes récurrents avec la Chine autour du récif de Scarborough. La présence militaire américaine dans le pays s'est renforcée.",
            en: "The Philippines faces recurring maritime incidents with China around Scarborough Shoal. US military presence in the country has strengthened.",
        },
        "Korean Peninsula": {
            fr: "La péninsule coréenne reste l'un des points chauds de la planète. La Corée du Nord poursuit ses tests de missiles balistiques et ses provocations. La DMZ est fortement militarisée des deux côtés.",
            en: "The Korean Peninsula remains one of the world's hotspots. North Korea continues ballistic missile tests and provocations. The DMZ is heavily militarized on both sides.",
        },
        "Afghanistan": {
            fr: "Sous le contrôle des Talibans, l'Afghanistan fait face à une insurrection de l'EI-K (Daech-Khorasan) avec des attentats réguliers. La crise humanitaire s'aggrave. Les droits des femmes sont systématiquement bafoués.",
            en: "Under Taliban control, Afghanistan faces an IS-K (Daesh-Khorasan) insurgency with regular attacks. The humanitarian crisis worsens. Women's rights are systematically violated.",
        },
        "Kashmir": {
            fr: "La ligne de contrôle (LoC) entre l'Inde et le Pakistan reste une zone de tensions avec des escarmouches occasionnelles. Le Cachemire indien fait face à des opérations anti-insurrection.",
            en: "The Line of Control (LoC) between India and Pakistan remains a tension zone with occasional skirmishes. Indian-administered Kashmir faces counter-insurgency operations.",
        },
        "Colombia": {
            fr: "Malgré les accords de paix de 2016, la Colombie fait face à la résurgence de groupes armés. L'ELN et les dissidents des FARC contrôlent des territoires. Le trafic de drogue alimente la violence.",
            en: "Despite the 2016 peace accords, Colombia faces the resurgence of armed groups. The ELN and FARC dissidents control territories. Drug trafficking fuels the violence.",
        },
        "Haiti": {
            fr: "Haïti est en proie à une crise sécuritaire sans précédent. Les gangs armés contrôlent une grande partie de Port-au-Prince. La mission de sécurité multinationale peine à stabiliser le pays.",
            en: "Haiti faces an unprecedented security crisis. Armed gangs control much of Port-au-Prince. The multinational security mission struggles to stabilize the country.",
        },
        "Iraq": {
            fr: "L'Irak fait face à des tensions entre les milices pro-iraniennes (PMF) et la présence militaire américaine. Les bases américaines subissent des attaques régulières. L'EI reste actif dans certaines zones rurales.",
            en: "Iraq faces tensions between pro-Iranian militias (PMF) and the US military presence. US bases face regular attacks. ISIS remains active in some rural areas.",
        },
        "Libya": {
            fr: "La Libye reste divisée entre le gouvernement de Tripoli et les forces de Haftar à l'est. Les mercenaires étrangers sont toujours présents. Les revenus pétroliers restent un enjeu central.",
            en: "Libya remains divided between the Tripoli government and Haftar's forces in the east. Foreign mercenaries remain present. Oil revenues remain a central issue.",
        },
        "South Caucasus": {
            fr: "Le conflit du Haut-Karabakh s'est conclu par le contrôle total azerbaïdjanais. Plus de 100 000 Arméniens ont fui. La situation humanitaire et les tensions frontalières persistent.",
            en: "The Nagorno-Karabakh conflict concluded with full Azerbaijani control. Over 100,000 Armenians fled. Humanitarian situation and border tensions persist.",
        },
        "Iran": {
            fr: "L'Iran reste un acteur central dans les conflits régionaux via ses réseaux de proxys (Hezbollah, Houthis, milices irakiennes). Le programme nucléaire fait l'objet de tensions internationales. Des frappes directes israéliennes ont eu lieu.",
            en: "Iran remains a central actor in regional conflicts through its proxy networks (Hezbollah, Houthis, Iraqi militias). The nuclear program is a source of international tensions. Direct Israeli strikes have occurred.",
        },
        "Saudi Arabia": {
            fr: "L'Arabie saoudite poursuit sa modernisation militaire et reste impliquée dans le conflit yéménite. Le royaume renforce ses capacités de défense antimissile face aux menaces houthies. Les relations avec l'Iran se normalisent progressivement.",
            en: "Saudi Arabia continues military modernization and remains involved in the Yemen conflict. The kingdom strengthens missile defense capabilities against Houthi threats. Relations with Iran are gradually normalizing.",
        },
        "UAE": {
            fr: "Les Émirats arabes unis maintiennent une présence militaire au Yémen et dans la Corne de l'Afrique. Abu Dhabi est un hub régional d'armement. Les EAU développent des capacités de défense avancées et des partenariats stratégiques.",
            en: "The UAE maintains military presence in Yemen and the Horn of Africa. Abu Dhabi is a regional arms hub. The UAE develops advanced defense capabilities and strategic partnerships.",
        },
        "Persian Gulf": {
            fr: "Le golfe Persique reste une zone stratégique majeure avec d'importantes bases militaires américaines. Les tensions Iran-Arabie saoudite, bien qu'en baisse, persistent. Le détroit d'Ormuz est un point de passage vital pour le pétrole mondial.",
            en: "The Persian Gulf remains a major strategic zone with significant US military bases. Iran-Saudi tensions, though reduced, persist. The Strait of Hormuz is a vital choke point for global oil.",
        },
        "Mexico": {
            fr: "Le Mexique fait face à une violence liée aux cartels parmi les plus intenses au monde. Les cartels de Sinaloa et Jalisco Nueva Generación se disputent le contrôle territorial. Les homicides, extorsions et trafics de drogues restent à des niveaux critiques. L'armée est déployée dans plusieurs États.",
            en: "Mexico faces some of the world's most intense cartel-related violence. The Sinaloa and Jalisco Nueva Generación cartels fight for territorial control. Homicides, extortion and drug trafficking remain at critical levels. The military is deployed across multiple states.",
        },
        "USA": {
            fr: "Les États-Unis maintiennent un réseau mondial de bases militaires et mènent des opérations dans plusieurs théâtres. Les tensions avec la Chine et la Russie définissent la politique étrangère. Le soutien militaire à l'Ukraine et à Israël reste un enjeu majeur. Des bases américaines au Moyen-Orient subissent des attaques.",
            en: "The US maintains a global network of military bases and conducts operations across multiple theaters. Tensions with China and Russia define foreign policy. Military support for Ukraine and Israel remains a key issue. US bases in the Middle East face attacks.",
        },
        "North Korea": {
            fr: "La Corée du Nord poursuit son programme nucléaire et ses tests de missiles balistiques intercontinentaux (ICBM). Kim Jong-un a intensifié les provocations et les lancements de satellites. Des troupes nord-coréennes seraient déployées en Russie pour combattre en Ukraine.",
            en: "North Korea continues its nuclear program and intercontinental ballistic missile (ICBM) tests. Kim Jong-un has intensified provocations and satellite launches. North Korean troops have reportedly been deployed to Russia to fight in Ukraine.",
        },
        "China": {
            fr: "La Chine renforce sa puissance militaire et ses revendications territoriales en mer de Chine méridionale et autour de Taïwan. L'APL mène des exercices de grande envergure. La rivalité stratégique avec les États-Unis s'intensifie dans les domaines militaire, technologique et économique.",
            en: "China strengthens its military power and territorial claims in the South China Sea and around Taiwan. The PLA conducts large-scale exercises. Strategic rivalry with the US intensifies across military, technological and economic domains.",
        },
        "Venezuela": {
            fr: "Le Venezuela traverse une crise politique et économique profonde. Les tensions avec le Guyana autour de la région de l'Essequibo persistent. L'armée reste fidèle au régime de Maduro. L'émigration massive déstabilise la région.",
            en: "Venezuela faces a deep political and economic crisis. Tensions with Guyana over the Essequibo region persist. The military remains loyal to the Maduro regime. Massive emigration destabilizes the region.",
        },
        "Central Africa": {
            fr: "La République centrafricaine est en proie à l'instabilité avec la présence de groupes armés et de mercenaires russes (Wagner/Africa Corps). Le gouvernement contrôle peu de territoire en dehors de Bangui.",
            en: "The Central African Republic is plagued by instability with armed groups and Russian mercenaries (Wagner/Africa Corps). The government controls little territory outside Bangui.",
        },
        "East Mediterranean": {
            fr: "La Méditerranée orientale est une zone de tensions croissantes entre la Grèce et la Turquie autour des ZEE et des ressources gazières. Chypre reste divisée. La Turquie maintient une présence militaire en Libye et en Syrie.",
            en: "The Eastern Mediterranean is a zone of growing tensions between Greece and Turkey over EEZs and gas resources. Cyprus remains divided. Turkey maintains military presence in Libya and Syria.",
        },
        "Pakistan": {
            fr: "Le Pakistan fait face au terrorisme du TTP (talibans pakistanais) et de l'EI-K. Les attaques contre les forces de sécurité sont fréquentes au Baloutchistan et dans les zones tribales. Les tensions avec l'Inde au Cachemire persistent.",
            en: "Pakistan faces terrorism from the TTP (Pakistani Taliban) and IS-K. Attacks on security forces are frequent in Balochistan and tribal areas. Tensions with India over Kashmir persist.",
        },
        "Djibouti": {
            fr: "Djibouti accueille des bases militaires de six pays (USA, France, Chine, Japon, Italie, Arabie saoudite). Sa position stratégique au détroit de Bab el-Mandeb en fait un point névralgique de la surveillance maritime mondiale.",
            en: "Djibouti hosts military bases from six countries (USA, France, China, Japan, Italy, Saudi Arabia). Its strategic position at the Bab el-Mandeb strait makes it a nerve center for global maritime surveillance.",
        },
        "Israel": {
            fr: "Israël est engagé sur plusieurs fronts : opérations à Gaza, échanges de tirs avec le Hezbollah au nord, menaces iraniennes. Le système Iron Dome est régulièrement activé. La dimension régionale du conflit s'élargit.",
            en: "Israel is engaged on multiple fronts: operations in Gaza, exchanges of fire with Hezbollah in the north, Iranian threats. The Iron Dome system is regularly activated. The regional dimension of the conflict is widening.",
        },
        "Russia": {
            fr: "La Russie maintient ses opérations offensives en Ukraine malgré les sanctions occidentales. L'économie de guerre s'est renforcée. Moscou développe ses partenariats avec la Chine, l'Iran et la Corée du Nord. Des bases russes sont déployées en Afrique.",
            en: "Russia maintains offensive operations in Ukraine despite Western sanctions. The war economy has strengthened. Moscow develops partnerships with China, Iran and North Korea. Russian bases are deployed in Africa.",
        },
    };

    /* ══════════════════════════════════════════════════════════════════
     *  BASELINE EVENTS
     * ═════════════════════════════════════════════════════════════════*/
    const BASELINE = [
        // ── UKRAINE (precise city coords) ──
        { n: "Bakhmut Front", r: "Ukraine", lat: 48.5953, lng: 37.9991, t: "combat", s: "critical" },
        { n: "Zaporizhzhia Front", r: "Ukraine", lat: 47.8388, lng: 35.1396, t: "combat", s: "critical" },
        { n: "Kherson Sector", r: "Ukraine", lat: 46.6354, lng: 32.6169, t: "combat", s: "high" },
        { n: "Kyiv — Missile Alerts", r: "Ukraine", lat: 50.4501, lng: 30.5234, t: "missile", s: "critical" },
        { n: "Odesa — Strikes", r: "Ukraine", lat: 46.4825, lng: 30.7233, t: "missile", s: "high" },
        { n: "Kharkiv — Air Raids", r: "Ukraine", lat: 49.9935, lng: 36.2304, t: "airstrike", s: "critical" },
        { n: "Dnipro — Strikes", r: "Ukraine", lat: 48.4647, lng: 35.0462, t: "airstrike", s: "high" },
        { n: "Kursk Front", r: "Russia/Ukraine", lat: 51.7304, lng: 36.1926, t: "combat", s: "high" },
        { n: "Donbas — Donetsk", r: "Ukraine", lat: 48.0159, lng: 37.8028, t: "troops", s: "high" },
        { n: "Sébastopol — Crimea", r: "Crimea", lat: 44.6166, lng: 33.5254, t: "missile", s: "high" },
        { n: "Black Sea — Naval", r: "Black Sea", lat: 43.50, lng: 32.00, t: "naval", s: "moderate" },
        // ── GAZA / ISRAEL ──
        { n: "Gaza City — Combat", r: "Gaza", lat: 31.5017, lng: 34.4668, t: "combat", s: "critical" },
        { n: "Rafah — Operations", r: "Gaza", lat: 31.2965, lng: 34.2472, t: "combat", s: "critical" },
        { n: "Khan Younis", r: "Gaza", lat: 31.3462, lng: 34.3015, t: "airstrike", s: "critical" },
        { n: "Jabalia — Humanitarian", r: "Gaza", lat: 31.5281, lng: 34.4831, t: "humanitarian", s: "critical" },
        { n: "Naplouse — Raids", r: "West Bank", lat: 32.2211, lng: 35.2544, t: "combat", s: "high" },
        { n: "Golan — Tensions", r: "Golan Heights", lat: 33.0057, lng: 35.7818, t: "tension", s: "moderate" },
        // ── LEBANON ──
        { n: "Naqoura — Sud Liban", r: "Lebanon", lat: 33.1172, lng: 35.1387, t: "airstrike", s: "high" },
        { n: "Beirut — Dahieh", r: "Lebanon", lat: 33.8938, lng: 35.5018, t: "missile", s: "high" },
        { n: "Baalbek — Bekaa", r: "Lebanon", lat: 34.0047, lng: 36.2110, t: "airstrike", s: "moderate" },
        // ── YEMEN / RED SEA ──
        { n: "Sanaa — Strikes", r: "Yemen", lat: 15.3694, lng: 44.1910, t: "airstrike", s: "high" },
        { n: "Hodeida Port", r: "Yemen", lat: 14.7979, lng: 42.9510, t: "missile", s: "high" },
        { n: "Red Sea — Houthi", r: "Red Sea", lat: 14.50, lng: 42.00, t: "naval", s: "high" },
        { n: "Bab el-Mandeb", r: "Red Sea", lat: 12.5833, lng: 43.3333, t: "naval", s: "high" },
        { n: "Aden — Humanitarian", r: "Yemen", lat: 12.7855, lng: 45.0187, t: "humanitarian", s: "critical" },
        // ── SYRIA ──
        { n: "Deir ez-Zor", r: "Syria", lat: 35.3359, lng: 40.1408, t: "combat", s: "high" },
        { n: "Idlib — Airstrikes", r: "Syria", lat: 35.9315, lng: 36.6317, t: "airstrike", s: "moderate" },
        { n: "Al-Tanf Base", r: "Syria", lat: 33.5117, lng: 38.6600, t: "tension", s: "moderate" },
        // ── SUDAN ──
        { n: "Khartoum — Fighting", r: "Sudan", lat: 15.5007, lng: 32.5599, t: "combat", s: "critical" },
        { n: "Nyala — Darfur", r: "Sudan", lat: 12.0489, lng: 24.8821, t: "combat", s: "critical" },
        { n: "El Fasher — Siege", r: "Sudan", lat: 13.6293, lng: 25.3493, t: "combat", s: "critical" },
        { n: "Adré — Refugees", r: "Sudan/Chad", lat: 13.4667, lng: 22.2000, t: "humanitarian", s: "critical" },
        // ── DR CONGO ──
        { n: "Goma — M23", r: "DR Congo", lat: -1.6585, lng: 29.2200, t: "combat", s: "critical" },
        { n: "Butembo — N.Kivu", r: "DR Congo", lat: -0.1365, lng: 29.2850, t: "combat", s: "high" },
        { n: "Bunia — Ituri ADF", r: "DR Congo", lat: 1.5590, lng: 30.2520, t: "combat", s: "high" },
        { n: "Bukavu — Displacement", r: "DR Congo", lat: -2.5000, lng: 28.8600, t: "humanitarian", s: "critical" },
        // ── MYANMAR ──
        { n: "Mandalay Resistance", r: "Myanmar", lat: 21.9588, lng: 96.0891, t: "combat", s: "critical" },
        { n: "Lashio — Shan State", r: "Myanmar", lat: 22.9362, lng: 97.7500, t: "combat", s: "high" },
        { n: "Sittwe — Rakhine", r: "Myanmar", lat: 20.1500, lng: 92.9000, t: "combat", s: "high" },
        { n: "Naypyidaw — Airstrikes", r: "Myanmar", lat: 19.7633, lng: 96.0785, t: "airstrike", s: "high" },
        // ── WEST AFRICA ──
        { n: "Tombouctou — JNIM", r: "Mali", lat: 16.7735, lng: -3.0074, t: "combat", s: "high" },
        { n: "Ouagadougou — Sahel", r: "Burkina Faso", lat: 12.3714, lng: -1.5197, t: "combat", s: "high" },
        { n: "Maiduguri — Boko H.", r: "Nigeria", lat: 11.8469, lng: 13.1600, t: "combat", s: "high" },
        { n: "Niamey — Clashes", r: "Niger", lat: 13.5137, lng: 2.1098, t: "combat", s: "moderate" },
        // ── EAST AFRICA ──
        { n: "Mogadishu — Al-Shabaab", r: "Somalia", lat: 2.0469, lng: 45.3182, t: "combat", s: "high" },
        { n: "Bahir Dar — Amhara", r: "Ethiopia", lat: 11.5936, lng: 37.3908, t: "combat", s: "high" },
        { n: "Mocímboa — Cabo D.", r: "Mozambique", lat: -11.3481, lng: 40.3548, t: "combat", s: "moderate" },
        // ── ASIA-PACIFIC ──
        { n: "Taiwan Strait Drills", r: "Taiwan Strait", lat: 24.15, lng: 119.50, t: "tension", s: "moderate" },
        { n: "Spratly Islands", r: "South China Sea", lat: 11.00, lng: 114.00, t: "naval", s: "moderate" },
        { n: "Scarborough Shoal", r: "Philippines", lat: 15.18, lng: 117.76, t: "naval", s: "moderate" },
        { n: "Panmunjom — DMZ", r: "Korean Peninsula", lat: 37.9563, lng: 126.6773, t: "tension", s: "moderate" },
        // ── OTHERS ──
        { n: "Kabul — ISIS-K", r: "Afghanistan", lat: 34.5281, lng: 69.1723, t: "combat", s: "high" },
        { n: "Srinagar — LoC", r: "Kashmir", lat: 34.0837, lng: 74.7973, t: "tension", s: "moderate" },
        { n: "Arauca — ELN", r: "Colombia", lat: 7.0847, lng: -70.7592, t: "combat", s: "moderate" },
        { n: "Port-au-Prince — Gangs", r: "Haiti", lat: 18.5392, lng: -72.3360, t: "combat", s: "high" },
        { n: "Baghdad — PMF", r: "Iraq", lat: 33.3152, lng: 44.3661, t: "troops", s: "moderate" },
        { n: "Tripoli — Factions", r: "Libya", lat: 32.9022, lng: 13.1800, t: "tension", s: "moderate" },
        { n: "Stepanakert — Aftermath", r: "South Caucasus", lat: 39.8153, lng: 46.7519, t: "humanitarian", s: "moderate" },
        { n: "Tehran — IRGC HQ", r: "Iran", lat: 35.6892, lng: 51.3890, t: "tension", s: "moderate" },
        { n: "Isfahan — Nuclear", r: "Iran", lat: 32.6546, lng: 51.6680, t: "tension", s: "high" },
        { n: "Natanz — Enrichment", r: "Iran", lat: 33.5114, lng: 51.9264, t: "tension", s: "high" },
        { n: "Bushehr — Reactor", r: "Iran", lat: 28.9684, lng: 50.8206, t: "tension", s: "moderate" },
        { n: "Bandar Abbas — Naval", r: "Iran", lat: 27.1865, lng: 56.2808, t: "naval", s: "moderate" },
        { n: "Tabriz — N-West", r: "Iran", lat: 38.0800, lng: 46.2919, t: "troops", s: "moderate" },
        // ── GULF STATES ──
        { n: "Strait of Hormuz", r: "Persian Gulf", lat: 26.5667, lng: 56.2500, t: "naval", s: "high" },
        { n: "Riyadh — Missile Def.", r: "Saudi Arabia", lat: 24.7136, lng: 46.6753, t: "missile", s: "moderate" },
        { n: "Al Dhafra — UAE Base", r: "UAE", lat: 24.2500, lng: 54.5500, t: "troops", s: "moderate" },
        { n: "Manama — US 5th Fleet", r: "Persian Gulf", lat: 26.2285, lng: 50.5860, t: "naval", s: "moderate" },
        { n: "Al Udeid — Qatar", r: "Persian Gulf", lat: 25.1174, lng: 51.3150, t: "troops", s: "moderate" },
        { n: "Kuwait City — US Base", r: "Persian Gulf", lat: 29.3759, lng: 47.9774, t: "troops", s: "moderate" },
        // ── NORTH KOREA ──
        { n: "Pyongyang — ICBM", r: "North Korea", lat: 39.0392, lng: 125.7625, t: "missile", s: "high" },
        { n: "Sohae — Tongchang-ri", r: "North Korea", lat: 39.6600, lng: 124.7053, t: "missile", s: "high" },
        { n: "Punggye-ri Nuclear", r: "North Korea", lat: 41.2814, lng: 129.0762, t: "tension", s: "high" },
        // ── CHINA ──
        { n: "Beijing — PLA HQ", r: "China", lat: 39.9042, lng: 116.4074, t: "tension", s: "moderate" },
        { n: "Xiamen — Fujian Ops", r: "China", lat: 24.4798, lng: 118.0894, t: "troops", s: "moderate" },
        { n: "Yulin — Hainan Naval", r: "China", lat: 18.2272, lng: 109.5040, t: "naval", s: "moderate" },
        // ── MEXICO ──
        { n: "Culiacán — Sinaloa", r: "Mexico", lat: 24.7994, lng: -107.3940, t: "combat", s: "high" },
        { n: "Guadalajara — CJNG", r: "Mexico", lat: 20.6597, lng: -103.3496, t: "combat", s: "high" },
        { n: "Tuxtla — Chiapas", r: "Mexico", lat: 16.7528, lng: -93.1152, t: "combat", s: "moderate" },
        { n: "Tijuana — Border", r: "Mexico", lat: 32.5149, lng: -117.0382, t: "combat", s: "moderate" },
        { n: "Acapulco — Guerrero", r: "Mexico", lat: 16.8531, lng: -99.8237, t: "combat", s: "high" },
        // ── USA ──
        { n: "Pentagon — Arlington", r: "USA", lat: 38.8719, lng: -77.0563, t: "troops", s: "moderate" },
        { n: "MacDill — CENTCOM", r: "USA", lat: 27.8492, lng: -82.5210, t: "troops", s: "moderate" },
        { n: "El Paso — Border Ops", r: "USA", lat: 31.7619, lng: -106.4850, t: "tension", s: "moderate" },
        // ── VENEZUELA ──
        { n: "Caracas — Crisis", r: "Venezuela", lat: 10.4806, lng: -66.9036, t: "tension", s: "moderate" },
        { n: "Essequibo — Dispute", r: "Venezuela", lat: 6.8000, lng: -58.1600, t: "tension", s: "moderate" },
        // ── EAST MED ──
        { n: "Lesbos — Aegean", r: "East Mediterranean", lat: 39.1000, lng: 26.3300, t: "tension", s: "moderate" },
        { n: "Nicosie — Chypre", r: "East Mediterranean", lat: 35.1856, lng: 33.3823, t: "tension", s: "moderate" },
        // ── CENTRAL AFRICA ──
        { n: "Bangui — Wagner/CAR", r: "Central Africa", lat: 4.3612, lng: 18.5550, t: "combat", s: "moderate" },
        // ── PAKISTAN ──
        { n: "Quetta — Balochistan", r: "Pakistan", lat: 30.1798, lng: 66.9750, t: "combat", s: "high" },
        { n: "Miranshah — Waziristan", r: "Pakistan", lat: 33.0000, lng: 70.0700, t: "combat", s: "moderate" },
        // ── DJIBOUTI ──
        { n: "Camp Lemonnier", r: "Djibouti", lat: 11.5475, lng: 43.1530, t: "troops", s: "moderate" },
        // ── RUSSIA ──
        { n: "Moscou — Kremlin", r: "Russia", lat: 55.7558, lng: 37.6173, t: "tension", s: "moderate" },
        { n: "Kaliningrad — Forces", r: "Russia", lat: 54.7104, lng: 20.4522, t: "troops", s: "moderate" },
        // ── ISRAEL ──
        { n: "Tel Aviv — Iron Dome", r: "Israel", lat: 32.0853, lng: 34.7818, t: "missile", s: "high" },
    ];

    /* ══════════════════════════════════════════════════════════════════
     *  TRAJECTORIES
     * ═════════════════════════════════════════════════════════════════*/
    const TRAJECTORIES = [
        { from: [55.75, 37.61], to: [50.45, 30.52], color: "#ff6b35", label: "Moscow → Kyiv" },
        { from: [55.75, 37.61], to: [49.99, 36.23], color: "#ff6b35", label: "Russia → Kharkiv" },
        { from: [55.75, 37.61], to: [46.47, 30.73], color: "#ff6b35", label: "Russia → Odesa" },
        { from: [45.04, 38.97], to: [44.95, 34.10], color: "#ff6b35", label: "Krasnodar → Crimea" },
        { from: [48.46, 35.05], to: [44.95, 34.10], color: "#fbbf24", label: "Ukraine → Crimea" },
        { from: [32.08, 34.78], to: [31.51, 34.44], color: "#fbbf24", label: "Tel Aviv → Gaza" },
        { from: [32.08, 34.78], to: [33.89, 35.50], color: "#fbbf24", label: "Israel → Beirut" },
        { from: [15.35, 44.21], to: [14.00, 42.50], color: "#22d3ee", label: "Yemen → Red Sea" },
        { from: [15.35, 44.21], to: [12.58, 43.33], color: "#22d3ee", label: "Yemen → Bab el-Mandeb" },
        { from: [24.47, 54.37], to: [15.35, 44.21], color: "#fbbf24", label: "Coalition → Sanaa" },
        { from: [32.43, 53.69], to: [33.89, 35.50], color: "#3b82f6", label: "Iran → Lebanon (proxy)" },
        { from: [32.43, 53.69], to: [15.35, 44.21], color: "#3b82f6", label: "Iran → Yemen (proxy)" },
        // North Korea missiles
        { from: [39.04, 125.75], to: [37.95, 131.00], color: "#ff6b35", label: "N.Korea → Sea of Japan" },
        { from: [39.66, 124.71], to: [30.00, 145.00], color: "#ff6b35", label: "N.Korea ICBM trajectory" },
        // Iran-Gulf
        { from: [32.43, 53.69], to: [26.57, 56.25], color: "#22d3ee", label: "Iran → Strait of Hormuz" },
        { from: [32.43, 53.69], to: [35.47, 44.39], color: "#3b82f6", label: "Iran → Iraq (proxy)" },
        // China-Taiwan
        { from: [26.07, 119.30], to: [24.15, 119.50], color: "#3b82f6", label: "China → Taiwan Strait" },
    ];

    /* ══════════════════════════════════════════════════════════════════
     *  GEO KEYWORDS
     * ═════════════════════════════════════════════════════════════════*/
    const GEO_KEYWORDS = [
        { kw: ["ukraine", "kyiv", "kiev", "kharkiv", "zaporizhzhia", "donbas", "odesa", "odessa", "bakhmut", "crimea", "kursk", "dnipro"], lat: 48.38, lng: 35.00, r: "Ukraine", type: "combat" },
        { kw: ["gaza", "hamas", "palestinian", "rafah", "khan younis"], lat: 31.40, lng: 34.35, r: "Gaza", type: "combat" },
        { kw: ["israel", "tel aviv", "idf", "netanyahu", "iron dome"], lat: 32.08, lng: 34.78, r: "Israel", type: "missile" },
        { kw: ["lebanon", "hezbollah", "beirut", "nabatieh"], lat: 33.60, lng: 35.50, r: "Lebanon", type: "airstrike" },
        { kw: ["yemen", "houthi", "sanaa", "hodeida", "aden"], lat: 15.35, lng: 44.21, r: "Yemen", type: "missile" },
        { kw: ["red sea", "bab el-mandeb", "shipping attack", "cargo ship"], lat: 13.50, lng: 42.80, r: "Red Sea", type: "naval" },
        { kw: ["sudan", "khartoum", "rsf", "darfur", "el fasher"], lat: 14.50, lng: 30.00, r: "Sudan", type: "combat" },
        { kw: ["congo", "drc", "m23", "goma", "kivu"], lat: -1.50, lng: 29.00, r: "DR Congo", type: "combat" },
        { kw: ["myanmar", "burma", "junta", "rakhine", "shan"], lat: 20.50, lng: 95.00, r: "Myanmar", type: "combat" },
        { kw: ["syria", "damascus", "idlib", "aleppo", "deir ez"], lat: 35.00, lng: 38.00, r: "Syria", type: "combat" },
        { kw: ["russia", "moscow", "kremlin", "putin"], lat: 55.75, lng: 37.61, r: "Russia", type: "tension" },
        { kw: ["taiwan", "taipei", "china strait"], lat: 24.15, lng: 119.50, r: "Taiwan", type: "tension" },
        { kw: ["south china sea", "spratly", "scarborough", "philippines navy"], lat: 12.00, lng: 115.00, r: "South China Sea", type: "naval" },
        { kw: ["north korea", "pyongyang", "icbm", "ballistic"], lat: 39.04, lng: 125.75, r: "North Korea", type: "missile" },
        { kw: ["tehran", "téhéran"], lat: 35.6892, lng: 51.3890, r: "Iran", type: "tension" },
        { kw: ["isfahan", "ispahan"], lat: 32.6546, lng: 51.6680, r: "Iran", type: "tension" },
        { kw: ["natanz", "enrichment", "enrichissement", "nucléaire iranien", "iranian nuclear"], lat: 33.5114, lng: 51.9264, r: "Iran", type: "tension" },
        { kw: ["bushehr", "bouchehr"], lat: 28.9684, lng: 50.8206, r: "Iran", type: "tension" },
        { kw: ["bandar abbas"], lat: 27.1865, lng: 56.2808, r: "Iran", type: "naval" },
        { kw: ["tabriz"], lat: 38.0800, lng: 46.2919, r: "Iran", type: "troops" },
        { kw: ["irgc", "revolutionary guard", "gardiens de la révolution", "pasdaran"], lat: 35.6892, lng: 51.3890, r: "Iran", type: "tension" },
        {
            kw: ["iran"], lat: 0, lng: 0, r: "Iran", type: "tension", multi: [
                { lat: 35.6892, lng: 51.3890 }, { lat: 32.6546, lng: 51.6680 },
                { lat: 33.5114, lng: 51.9264 }, { lat: 28.9684, lng: 50.8206 },
                { lat: 27.1865, lng: 56.2808 }, { lat: 38.0800, lng: 46.2919 },
            ]
        },
        { kw: ["somalia", "mogadishu", "al-shabaab", "al shabaab"], lat: 2.05, lng: 45.32, r: "Somalia", type: "combat" },
        { kw: ["mali", "bamako", "jnim", "sahel"], lat: 14.60, lng: -4.00, r: "Mali", type: "combat" },
        { kw: ["nigeria", "boko haram", "iswap", "maiduguri"], lat: 11.85, lng: 13.15, r: "Nigeria", type: "combat" },
        { kw: ["afghanistan", "taliban", "kabul", "isis-k"], lat: 34.53, lng: 69.17, r: "Afghanistan", type: "combat" },
        { kw: ["haiti", "port-au-prince", "gang"], lat: 18.54, lng: -72.34, r: "Haiti", type: "combat" },
        // New regions
        { kw: ["saudi", "arabie saoudite", "riyad", "riyadh", "mbs", "saudi arabia"], lat: 24.71, lng: 46.67, r: "Saudi Arabia", type: "tension" },
        { kw: ["émirats", "emirates", "uae", "abu dhabi", "dubai"], lat: 24.45, lng: 54.65, r: "UAE", type: "tension" },
        { kw: ["qatar", "doha"], lat: 25.28, lng: 51.52, r: "Persian Gulf", type: "tension" },
        { kw: ["hormuz", "ormuz", "golfe persique", "persian gulf", "bahrain", "bahreïn"], lat: 26.57, lng: 56.25, r: "Persian Gulf", type: "naval" },
        { kw: ["mexique", "mexico", "cartel", "sinaloa", "jalisco", "cjng", "narco", "tijuana", "chiapas", "guerrero"], lat: 23.63, lng: -102.55, r: "Mexico", type: "combat" },
        { kw: ["pentagon", "us military", "américain", "centcom", "états-unis", "united states", "white house", "maison blanche"], lat: 38.87, lng: -77.06, r: "USA", type: "troops" },
        { kw: ["corée du nord", "north korea", "pyongyang", "kim jong"], lat: 39.04, lng: 125.75, r: "North Korea", type: "missile" },
        { kw: ["chine", "china", "beijing", "pékin", "pla", "armée populaire", "xi jinping"], lat: 39.91, lng: 116.39, r: "China", type: "tension" },
        { kw: ["venezuela", "caracas", "maduro", "essequibo"], lat: 10.49, lng: -66.88, r: "Venezuela", type: "tension" },
        { kw: ["centrafrique", "central african", "bangui", "car"], lat: 4.36, lng: 18.56, r: "Central Africa", type: "combat" },
        { kw: ["méditerranée", "mediterranean", "chypre", "cyprus", "égée", "aegean", "grèce turquie", "greece turkey"], lat: 35.17, lng: 33.36, r: "East Mediterranean", type: "tension" },
        { kw: ["pakistan", "islamabad", "balochistan", "baloutchistan", "waziristan", "ttp"], lat: 30.20, lng: 67.00, r: "Pakistan", type: "combat" },
        { kw: ["djibouti"], lat: 11.59, lng: 43.15, r: "Djibouti", type: "troops" },
        { kw: ["turquie", "turkey", "ankara", "erdogan"], lat: 39.93, lng: 32.86, r: "East Mediterranean", type: "tension" },
        { kw: ["inde", "india", "new delhi", "modi"], lat: 28.61, lng: 77.21, r: "Kashmir", type: "tension" },
        // Additional country matchers for broad surveillance
        { kw: ["japon", "japan", "tokyo", "okinawa", "jsdf"], lat: 35.68, lng: 139.69, r: "Japan", type: "tension" },
        { kw: ["corée du sud", "south korea", "seoul", "séoul"], lat: 37.57, lng: 126.98, r: "Korean Peninsula", type: "tension" },
        { kw: ["pologne", "poland", "varsovie", "warsaw", "baltic", "baltique", "lithuania", "lituanie", "estonia", "estonie", "latvia", "lettonie"], lat: 52.23, lng: 21.01, r: "NATO East", type: "troops" },
        { kw: ["roumanie", "romania", "bucharest", "bucarest", "moldavie", "moldova"], lat: 44.43, lng: 26.10, r: "NATO East", type: "troops" },
        { kw: ["philippines", "manille", "manila", "duterte", "marcos"], lat: 14.60, lng: 120.98, r: "Philippines", type: "tension" },
        { kw: ["indonésie", "indonesia", "jakarta"], lat: -6.21, lng: 106.85, r: "South China Sea", type: "tension" },
        { kw: ["égypte", "egypt", "cairo", "le caire", "sinaï", "sinai", "suez"], lat: 30.04, lng: 31.24, r: "Egypt", type: "tension" },
        { kw: ["kenya", "nairobi"], lat: -1.29, lng: 36.82, r: "Somalia", type: "combat" },
        { kw: ["arctique", "arctic", "groenland", "greenland"], lat: 72.00, lng: -40.00, r: "Arctic", type: "tension" },
        // Type-only matchers (no location)
        { kw: ["missile", "icbm", "ballistic missile", "cruise missile", "drone strike", "shahed"], lat: null, lng: null, r: null, type: "missile" },
        { kw: ["airstrike", "air strike", "bombing", "bombardment", "aerial", "frappe aérienne"], lat: null, lng: null, r: null, type: "airstrike" },
        { kw: ["navy", "warship", "destroyer", "aircraft carrier", "naval", "marine", "porte-avions"], lat: null, lng: null, r: null, type: "naval" },
        { kw: ["humanitarian", "refugee", "displaced", "famine", "aid convoy", "humanitaire", "réfugié", "déplacé"], lat: null, lng: null, r: null, type: "humanitarian" },
        { kw: ["sanctions", "embargo", "diplomatie", "diplomacy", "sommet", "summit"], lat: null, lng: null, r: null, type: "tension" },
    ];

    /* ══════════════════════════════════════════════════════════════════
     *  i18n
     * ═════════════════════════════════════════════════════════════════*/
    const i18n = {
        fr: {
            title: "Conflict Tracker", breaking: "ALERTE", legend: "LÉGENDE", trajectories: "Trajectoires",
            noNews: "Aucune actu.", events: "événements", liveEvents: "en direct",
            intel: "RÉSUMÉ DE RENSEIGNEMENT", keyEvents: "ÉVÉNEMENTS CLÉS", relatedNews: "ACTUALITÉS LIÉES",
            noRelatedNews: "Aucune actualité liée détectée."
        },
        en: {
            title: "Conflict Tracker", breaking: "BREAKING", legend: "LEGEND", trajectories: "Trajectories",
            noNews: "No news.", events: "events", liveEvents: "live",
            intel: "INTELLIGENCE SUMMARY", keyEvents: "KEY EVENTS", relatedNews: "RELATED NEWS",
            noRelatedNews: "No related news detected."
        },
    };
    let lang = localStorage.getItem(LANG_KEY) || "fr";
    if (lang !== "fr" && lang !== "en") lang = "fr";
    let theme = localStorage.getItem(THEME_KEY) || "dark";
    if (theme !== "dark" && theme !== "light") theme = "dark";
    const t = k => (i18n[lang] || i18n.en)[k] || k;
    const tType = type => lang === "fr" ? TYPES[type]?.fr : TYPES[type]?.en;

    /* ── Theme & Lang ── */
    function applyTheme(th) {
        theme = th === "light" ? "light" : "dark";
        document.documentElement.setAttribute("data-theme", theme);
        $("themeToggle").textContent = theme === "dark" ? "🌙" : "☀️";
    }
    function applyLang(l) {
        lang = l === "en" ? "en" : "fr";
        $("langToggle").textContent = lang.toUpperCase();
        const s = (id, k) => { const e = $(id); if (e) e.textContent = t(k); };
        s("t-title", "title"); s("t-breaking", "breaking"); s("t-legend", "legend");
        s("t-intel", "intel"); s("t-key-events", "keyEvents"); s("t-related-news", "relatedNews");
        renderLegend(); renderStatsBar();
    }
    $("themeToggle").addEventListener("click", () => { applyTheme(theme === "dark" ? "light" : "dark"); localStorage.setItem(THEME_KEY, theme); });
    $("langToggle").addEventListener("click", () => { applyLang(lang === "fr" ? "en" : "fr"); localStorage.setItem(LANG_KEY, lang); });
    window.addEventListener("storage", e => {
        if (e.key === THEME_KEY && e.newValue) applyTheme(e.newValue);
        if (e.key === LANG_KEY && e.newValue) applyLang(e.newValue);
    });

    function showToast(msg) { const el = $("toast"); el.textContent = msg; el.classList.add("visible"); clearTimeout(el._t); el._t = setTimeout(() => el.classList.remove("visible"), 3000); }

    /* ══════════════════════════════════════════════════════════════════
     *  LOCAL CITIES GEOCODING DATABASE
     *  Precise GPS coordinates for instant geocoding — no external API
     * ═════════════════════════════════════════════════════════════════*/
    const CITIES_DB = {
        // Ukraine
        "kyiv": [50.4501, 30.5234], "kharkiv": [49.9935, 36.2304], "bakhmut": [48.5953, 37.9991],
        "zaporizhzhia": [47.8388, 35.1396], "kherson": [46.6354, 32.6169], "odesa": [46.4825, 30.7233],
        "donetsk": [48.0159, 37.8029], "luhansk": [48.5740, 39.3078], "mariupol": [47.0958, 37.5495],
        "dnipro": [48.4647, 35.0462], "sevastopol": [44.6167, 33.5254], "crimea": [44.9521, 34.1024],
        "sumy": [50.9077, 34.7981], "pokrovsk": [48.2842, 37.1827], "avdiivka": [48.1408, 37.7475],
        // Middle East
        "gaza": [31.5, 34.47], "rafah": [31.2968, 34.2451], "khan younis": [31.3462, 34.3032],
        "jabalia": [31.5281, 34.4833], "jerusalem": [31.7683, 35.2137], "tel aviv": [32.0853, 34.7818],
        "beersheba": [31.2518, 34.7913], "haifa": [32.7940, 34.9896], "nablus": [32.2211, 35.2544],
        "beirut": [33.8938, 35.5018], "naqoura": [33.1192, 35.1386], "baalbek": [34.0047, 36.2110],
        "sidon": [33.5633, 35.3697], "tyre": [33.2705, 35.2038],
        "damascus": [33.5138, 36.2765], "aleppo": [36.2021, 37.1343], "idlib": [35.9306, 36.6339],
        "baghdad": [33.3152, 44.3661], "erbil": [36.1912, 44.0119], "kirkuk": [35.4681, 44.3922],
        "sanaa": [15.3694, 44.1910], "aden": [12.7855, 45.0187], "hodeida": [14.7980, 42.9540],
        "marib": [15.4543, 45.3264],
        // Iran
        "tehran": [35.6892, 51.3890], "isfahan": [32.6546, 51.6680], "natanz": [33.5114, 51.9264],
        "bushehr": [28.9684, 50.8206], "bandar abbas": [27.1865, 56.2808], "tabriz": [38.0800, 46.2919],
        "shiraz": [29.5918, 52.5837], "mashhad": [36.2972, 59.6067], "qom": [34.6396, 50.8764],
        // Gulf
        "riyadh": [24.7136, 46.6753], "jeddah": [21.4858, 39.1925], "abu dhabi": [24.4539, 54.3773],
        "dubai": [25.2048, 55.2708], "doha": [25.2854, 51.5310], "manama": [26.2285, 50.5860],
        "kuwait city": [29.3759, 47.9774],
        // Africa
        "khartoum": [15.5007, 32.5599], "el fasher": [13.6297, 25.3493], "mogadishu": [2.0469, 45.3182],
        "goma": [-1.6585, 29.2203], "kinshasa": [-4.4419, 15.2663], "bangui": [4.3612, 18.5550],
        "bamako": [12.6392, -8.0029], "niamey": [13.5137, 2.1098], "maiduguri": [11.8311, 13.1510],
        "lagos": [6.5244, 3.3792], "addis ababa": [9.0250, 38.7469], "nairobi": [-1.2921, 36.8219],
        "tripoli": [32.9022, 13.1800], "benghazi": [32.1194, 20.0863], "port sudan": [19.6158, 37.2164],
        // Asia
        "kabul": [34.5281, 69.1723], "islamabad": [33.6844, 73.0479], "quetta": [30.1798, 66.9750],
        "srinagar": [34.0837, 74.7973], "new delhi": [28.6139, 77.2090],
        "taipei": [25.0330, 121.5654], "beijing": [39.9042, 116.4074], "pyongyang": [39.0392, 125.7625],
        "seoul": [37.5665, 126.9780], "tokyo": [35.6762, 139.6503],
        "yangon": [16.8661, 96.1951], "naypyidaw": [19.7633, 96.0785], "mandalay": [21.9588, 96.0891],
        // Americas
        "culiacán": [24.8091, -107.3940], "guadalajara": [20.6597, -103.3496], "tijuana": [32.5149, -117.0382],
        "acapulco": [16.8531, -99.8237], "ciudad juárez": [31.6904, -106.4245],
        "port-au-prince": [18.5392, -72.3360], "bogotá": [4.7110, -74.0721], "caracas": [10.4806, -66.9036],
        // Europe / NATO
        "moscow": [55.7558, 37.6173], "ankara": [39.9334, 32.8597], "warsaw": [52.2297, 21.0122],
        "bucharest": [44.4268, 26.1025], "stepanakert": [39.8153, 46.7519],
        // Misc
        "djibouti": [11.5880, 43.1456],
    };

    /* ══════════════════════════════════════════════════════════════════
     *  RSS FETCHING
     * ═════════════════════════════════════════════════════════════════*/
    async function fetchT(url, init = {}) {
        const c = new AbortController(); const tm = setTimeout(() => c.abort(), FETCH_TIMEOUT);
        try { return await fetch(url, { ...init, signal: c.signal, cache: "no-store" }); } finally { clearTimeout(tm); }
    }
    function parseXml(xml) {
        const doc = new DOMParser().parseFromString(xml, "text/xml");
        if (doc.querySelector("parsererror")) throw new Error("bad xml");
        const out = [];
        doc.querySelectorAll("item").forEach(i => out.push({ title: i.querySelector("title")?.textContent || "", pubDate: i.querySelector("pubDate")?.textContent || "" }));
        if (out.length) return out;
        doc.querySelectorAll("entry").forEach(e => out.push({ title: e.querySelector("title")?.textContent || "", pubDate: e.querySelector("published")?.textContent || e.querySelector("updated")?.textContent || "" }));
        return out;
    }
    async function rss2json(url) {
        const r = await fetchT("https://api.rss2json.com/v1/api.json?count=40&rss_url=" + encodeURIComponent(url));
        if (!r.ok) throw new Error(r.status); const d = await r.json();
        if (d.status && d.status !== "ok") throw new Error("err");
        return (d.items || []).map(i => ({ title: i.title || "", pubDate: i.pubDate || "" }));
    }
    async function allorigins(url) { const r = await fetchT("https://api.allorigins.win/raw?url=" + encodeURIComponent(url)); if (!r.ok) throw new Error(r.status); return parseXml(await r.text()); }
    async function corsproxy(url) { const r = await fetchT("https://corsproxy.io/?url=" + encodeURIComponent(url)); if (!r.ok) throw new Error(r.status); return parseXml(await r.text()); }
    async function fetchRss(url) {
        const attempts = [rss2json, corsproxy, allorigins].map(fn => fn(url).then(items => { if (!items?.length) throw new Error("empty"); return items; }));
        try { return await Promise.any(attempts); } catch { return []; }
    }
    function stripHtml(h) { return h ? new DOMParser().parseFromString(String(h), "text/html").body?.textContent || "" : ""; }

    /* ══════════════════════════════════════════════════════════════════
     *  LIVE NEWS FETCHING & GEOLOCATION
     * ═════════════════════════════════════════════════════════════════*/
    let liveEvents = [];
    let allHeadlinesCache = []; // Keep for related news matching

    const RSS_FEEDS = {
        fr: [
            `https://news.google.com/rss/search?q=${encodeURIComponent("conflit OR guerre OR missile OR offensive OR bombardement OR frappe")}&hl=fr&gl=FR&ceid=FR:fr`,
            `https://news.google.com/rss/search?q=${encodeURIComponent("Ukraine OR Gaza OR Soudan OR Yemen OR Liban OR Iran")}&hl=fr&gl=FR&ceid=FR:fr`,
            `https://news.google.com/rss/search?q=${encodeURIComponent("Corée du Nord OR Chine OR Taïwan OR Mexique cartel OR Venezuela")}&hl=fr&gl=FR&ceid=FR:fr`,
            `https://news.google.com/rss/search?q=${encodeURIComponent("tensions militaires OR armée OR marine OR défense OR OTAN")}&hl=fr&gl=FR&ceid=FR:fr`,
            `https://news.google.com/rss/search?q=${encodeURIComponent("Arabie saoudite OR Émirats OR golfe Persique OR Pakistan OR Afghanistan")}&hl=fr&gl=FR&ceid=FR:fr`,
            `https://news.google.com/rss/search?q=${encodeURIComponent("Japon militaire OR Corée du Sud OR Inde Pakistan OR nucléaire")}&hl=fr&gl=FR&ceid=FR:fr`,
            `https://news.google.com/rss/search?q=${encodeURIComponent("Afrique sahel OR Somalie OR Éthiopie OR Congo OR terrorisme")}&hl=fr&gl=FR&ceid=FR:fr`,
            `https://news.google.com/rss/search?q=${encodeURIComponent("OTAN Russie OR Pologne OR Roumanie OR Baltique OR Arctique")}&hl=fr&gl=FR&ceid=FR:fr`,
            `https://news.google.com/rss/search?q=${encodeURIComponent("Colombie drogue OR Haïti gang OR Amérique centrale migrant")}&hl=fr&gl=FR&ceid=FR:fr`,
            `https://news.google.com/rss/search?q=${encodeURIComponent("attentat OR explosion OR insurrection OR coup d'état OR sanctions")}&hl=fr&gl=FR&ceid=FR:fr`,
        ],
        en: [
            `https://news.google.com/rss/search?q=${encodeURIComponent("conflict OR war OR missile OR offensive OR attack OR airstrike")}&hl=en&gl=US&ceid=US:en`,
            `https://news.google.com/rss/search?q=${encodeURIComponent("Ukraine OR Gaza OR Sudan OR Yemen OR Lebanon OR Iran")}&hl=en&gl=US&ceid=US:en`,
            `https://news.google.com/rss/search?q=${encodeURIComponent("North Korea OR China OR Taiwan OR Mexico cartel OR Venezuela")}&hl=en&gl=US&ceid=US:en`,
            `https://news.google.com/rss/search?q=${encodeURIComponent("military tensions OR navy OR defense OR NATO OR Pentagon")}&hl=en&gl=US&ceid=US:en`,
            `https://news.google.com/rss/search?q=${encodeURIComponent("Saudi Arabia OR UAE OR Persian Gulf OR Pakistan OR Afghanistan")}&hl=en&gl=US&ceid=US:en`,
            `https://news.google.com/rss/search?q=${encodeURIComponent("Japan military OR South Korea OR India Pakistan OR nuclear threat")}&hl=en&gl=US&ceid=US:en`,
            `https://news.google.com/rss/search?q=${encodeURIComponent("Africa sahel OR Somalia OR Ethiopia OR Congo OR terrorism")}&hl=en&gl=US&ceid=US:en`,
            `https://news.google.com/rss/search?q=${encodeURIComponent("NATO Russia OR Poland OR Romania OR Baltic OR Arctic military")}&hl=en&gl=US&ceid=US:en`,
            `https://news.google.com/rss/search?q=${encodeURIComponent("Colombia drug OR Haiti gang OR Central America insurgency")}&hl=en&gl=US&ceid=US:en`,
            `https://news.google.com/rss/search?q=${encodeURIComponent("bombing OR explosion OR insurrection OR coup OR sanctions military")}&hl=en&gl=US&ceid=US:en`,
        ],
    };

    function geolocateHeadline(title) {
        const lower = title.toLowerCase();

        // 1. Try precise city match from local CITIES_DB first
        for (const [city, coords] of Object.entries(CITIES_DB)) {
            if (lower.includes(city)) {
                // Find event type from GEO_KEYWORDS
                let eventType = "combat";
                for (const geo of GEO_KEYWORDS) {
                    for (const kw of geo.kw) { if (lower.includes(kw.toLowerCase())) { eventType = geo.type; break; } }
                }
                // Find region
                let region = "Unknown";
                for (const g of GEO_KEYWORDS) {
                    if (!g.lat || !g.r) continue;
                    if (Math.sqrt((coords[0] - g.lat) ** 2 + (coords[1] - g.lng) ** 2) < 5) { region = g.r; break; }
                }
                const jitter = () => (Math.random() - 0.5) * 0.08;
                return { n: title.substring(0, 80) + (title.length > 80 ? "…" : ""), r: region, lat: coords[0] + jitter(), lng: coords[1] + jitter(), t: eventType, s: "high", live: true };
            }
        }

        // 2. Fallback to GEO_KEYWORDS region match
        let location = null;
        for (const geo of GEO_KEYWORDS) {
            if (geo.lat === null) continue;
            for (const kw of geo.kw) { if (lower.includes(kw.toLowerCase())) { location = geo; break; } }
            if (location) break;
        }
        let eventType = location?.type || "combat";
        for (const geo of GEO_KEYWORDS) {
            if (geo.lat !== null) continue;
            for (const kw of geo.kw) { if (lower.includes(kw.toLowerCase())) { eventType = geo.type; break; } }
        }
        if (!location) return null;
        let baseLat = location.lat, baseLng = location.lng;
        if (location.multi) {
            const pick = location.multi[Math.floor(Math.random() * location.multi.length)];
            baseLat = pick.lat; baseLng = pick.lng;
        }
        const jitter = () => (Math.random() - 0.5) * 0.15;
        return { n: title.substring(0, 80) + (title.length > 80 ? "…" : ""), r: location.r, lat: baseLat + jitter(), lng: baseLng + jitter(), t: eventType, s: "high", live: true };
    }

    /** Find news headlines related to a given region */
    function findRelatedNews(region) {
        if (!allHeadlinesCache.length) return [];
        const geo = GEO_KEYWORDS.find(g => g.r === region);
        if (!geo) return [];
        const kws = geo.kw;
        return allHeadlinesCache.filter(item => {
            const lower = item.title.toLowerCase();
            return kws.some(kw => lower.includes(kw.toLowerCase()));
        }).slice(0, 8);
    }

    /* ══════════════════════════════════════════════════════════════════
     *  GDELT GEO v2 — Free, CORS *, GeoJSON with city-level coordinates
     * ═════════════════════════════════════════════════════════════════*/
    async function fetchGdeltEvents() {
        const queries = lang === "fr"
            ? ["conflit OR guerre OR frappe OR missile", "offensive OR bombardement OR attaque"]
            : ["conflict OR war OR strike OR missile", "offensive OR bombing OR attack"];
        const events = [];
        for (const q of queries) {
            try {
                const url = `https://api.gdeltproject.org/api/v2/geo/geo?query=${encodeURIComponent(q)}&format=GeoJSON&timespan=24h`;
                const r = await fetchT(url);
                if (!r.ok) continue;
                const geo = await r.json();
                if (!geo.features) continue;
                for (const f of geo.features) {
                    if (!f.geometry?.coordinates) continue;
                    const [lng, lat] = f.geometry.coordinates;
                    const name = f.properties?.name || f.properties?.html || "GDELT Event";
                    const cleanName = stripHtml(name).substring(0, 80);
                    // Determine type from name
                    const lower = cleanName.toLowerCase();
                    let type = "tension";
                    if (/missile|strike|frappe/.test(lower)) type = "missile";
                    else if (/airstrike|bomb|aerial/.test(lower)) type = "airstrike";
                    else if (/combat|battle|fight|clash/.test(lower)) type = "combat";
                    else if (/naval|ship|fleet|maritime/.test(lower)) type = "naval";
                    else if (/humanitarian|refugee|displaced/.test(lower)) type = "humanitarian";
                    else if (/troop|deploy|military/.test(lower)) type = "troops";
                    // Find region from coordinates
                    let region = "Unknown";
                    for (const geo of GEO_KEYWORDS) {
                        if (!geo.lat || !geo.r) continue;
                        const dist = Math.sqrt(Math.pow(lat - geo.lat, 2) + Math.pow(lng - geo.lng, 2));
                        if (dist < 5) { region = geo.r; break; }
                    }
                    events.push({ n: cleanName, r: region, lat, lng, t: type, s: "high", live: true, source: "gdelt" });
                }
            } catch { /* GDELT request failed, continue */ }
        }
        return events;
    }

    /* ══════════════════════════════════════════════════════════════════
     *  RELIEFWEB — Free, CORS-friendly, conflict/disaster reports
     * ═════════════════════════════════════════════════════════════════*/
    async function fetchReliefWebReports() {
        const headlines = [];
        try {
            const url = "https://api.reliefweb.int/v1/reports?appname=conflict-tracker" +
                "&filter[field]=disaster_type.name&filter[value]=Conflict" +
                "&limit=30&sort[]=date:desc" +
                "&fields[include][]=title&fields[include][]=country&fields[include][]=date";
            const r = await fetchT(url);
            if (!r.ok) return [];
            const data = await r.json();
            if (!data.data) return [];
            for (const item of data.data) {
                const title = item.fields?.title || "";
                const countries = item.fields?.country || [];
                const date = item.fields?.date?.created || "";
                if (title) headlines.push({ title, pubDate: date, source: "reliefweb", countries });
            }
        } catch { /* ReliefWeb unavailable */ }
        return headlines;
    }

    /* ══════════════════════════════════════════════════════════════════
     *  OSINT WEB SCRAPING — Extract events from OSINT pages via proxy
     *  Sources: Live maps, humanitarian orgs, OSINT/military blogs
     * ═════════════════════════════════════════════════════════════════*/

    // Helper: detect event type from surrounding text context
    function detectEventType(text) {
        const t = text.toLowerCase();
        if (/missile|rocket|balistique|ballistic/.test(t)) return "missile";
        if (/airstrike|aerial|frappe a[eé]rienne|air raid|bombing|bombardement/.test(t)) return "airstrike";
        if (/naval|ship|fleet|maritime|destroyer|frigate/.test(t)) return "naval";
        if (/drone|uav|unmanned/.test(t)) return "airstrike";
        if (/humanitarian|refugee|r[eé]fugi[eé]|displaced|d[eé]plac[eé]|aid|aide/.test(t)) return "humanitarian";
        if (/troop|deploy|d[eé]ploiement|military buildup|renfort/.test(t)) return "troops";
        if (/tension|sanction|protest|manifestation|coup d'[eé]tat/.test(t)) return "tension";
        if (/battle|clash|combat|fight|assault|offensive|counter.?offensive/.test(t)) return "combat";
        if (/explosion|blast|detonation|ied|mine/.test(t)) return "airstrike";
        if (/killed|casualties|victim|mort|tu[eé]|fatalities/.test(t)) return "combat";
        return "combat";
    }

    // Helper: find region from coords using GEO_KEYWORDS
    function findRegionFromCoords(lat, lng) {
        for (const g of GEO_KEYWORDS) {
            if (!g.lat || !g.r) continue;
            if (Math.sqrt((lat - g.lat) ** 2 + (lng - g.lng) ** 2) < 5) return g.r;
        }
        return "Unknown";
    }

    // Conflict keywords for context matching (bilingual)
    const CONFLICT_CONTEXT_RE = /attack|strike|bomb|combat|killed|troops|missile|explosion|clash|offensive|assault|casualties|shelling|artillery|drone|frappe|tué|mort|bombardement|attaque|explosion|obus|roquette|troupes|déployé|destroyed|seized|captured|frontline|advance/i;

    async function scrapeOsintSources() {
        const allEvents = [];

        // ONLY live conflict map sources — blogs/institutions produce too much noise
        const OSINT_SOURCES = [
            { url: "https://liveuamap.com/", name: "LiveUAMap" },
            { url: "https://syria.liveuamap.com/", name: "LiveUAMap Syria" },
            { url: "https://deepstatemap.live/", name: "DeepState" },
        ];

        const proxies = [
            u => `https://api.allorigins.win/raw?url=${encodeURIComponent(u)}`,
            u => `https://corsproxy.io/?url=${encodeURIComponent(u)}`,
        ];

        const results = await Promise.allSettled(OSINT_SOURCES.map(async (src) => {
            const events = [];
            let html = null;
            for (const mkProxy of proxies) {
                try {
                    const r = await fetchT(mkProxy(src.url));
                    if (r.ok) { html = await r.text(); break; }
                } catch { /* next proxy */ }
            }
            if (!html) return events;

            // Extract GPS coordinates only (no city name matching — too noisy)
            const coordPattern = /([\-]?\d{1,3}\.\d{4,})[,\s]+([\-]?\d{1,3}\.\d{4,})/g;
            const seenCoords = new Set();
            let match;
            while ((match = coordPattern.exec(html)) !== null) {
                const lat = parseFloat(match[1]);
                const lng = parseFloat(match[2]);
                if (lat < -90 || lat > 90 || lng < -180 || lng > 180) continue;
                if (lat === 0 && lng === 0) continue;
                // Strict: must be within 3° of a known conflict zone
                const region = findRegionFromCoords(lat, lng);
                if (region === "Unknown") continue;
                const key = `${lat.toFixed(2)},${lng.toFixed(2)}`;
                if (seenCoords.has(key)) continue;
                seenCoords.add(key);
                // Context for event type
                const ctx = html.substring(Math.max(0, match.index - 200), match.index + 200);
                const evType = detectEventType(ctx);
                events.push({ n: `${src.name} — ${region}`, r: region, lat, lng, t: evType, s: "high", live: true, source: "osint" });
                if (events.length >= 30) break; // Cap per source
            }
            return events;
        }));

        for (const r of results) {
            if (r.status === "fulfilled") allEvents.push(...r.value);
        }
        console.log(`[CT] OSINT: ${allEvents.length} events from map sources`);
        return allEvents;
    }

    /* ══════════════════════════════════════════════════════════════════
     *  DATA FUSION — Merge all sources, deduplicate by proximity
     * ═════════════════════════════════════════════════════════════════*/
    function haversineKm(lat1, lon1, lat2, lon2) {
        const R = 6371;
        const dLat = (lat2 - lat1) * Math.PI / 180;
        const dLon = (lon2 - lon1) * Math.PI / 180;
        const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
        return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    }

    function deduplicateEvents(events) {
        // Priority: osint > gdelt > rss (higher precision wins)
        const priority = { osint: 3, gdelt: 2, rss: 1, reliefweb: 0 };
        events.sort((a, b) => (priority[b.source] || 0) - (priority[a.source] || 0));
        const kept = [];
        for (const ev of events) {
            const isDupe = kept.some(k =>
                haversineKm(ev.lat, ev.lng, k.lat, k.lng) < 50 &&
                ev.t === k.t
            );
            if (!isDupe) kept.push(ev);
        }
        return kept;
    }

    /* ══════════════════════════════════════════════════════════════════
     *  LIVE NEWS FETCHING — Multi-source aggregation
     * ═════════════════════════════════════════════════════════════════*/
    async function fetchLiveEvents() {
        // 1. RSS feeds (existing)
        const feeds = RSS_FEEDS[lang] || RSS_FEEDS.en;
        const allItems = [];
        const rssResults = await Promise.allSettled(feeds.map(url => fetchRss(url)));
        rssResults.forEach(r => { if (r.status === "fulfilled") allItems.push(...r.value); });

        // 2. ReliefWeb reports (add to headline pool)
        const rwReports = await fetchReliefWebReports();
        for (const rw of rwReports) { allItems.push({ title: rw.title, pubDate: rw.pubDate }); }

        // Deduplicate headlines
        const seen = new Set(); const unique = [];
        for (const item of allItems) {
            const clean = stripHtml(item.title).trim();
            if (!clean || seen.has(clean.toLowerCase())) continue;
            seen.add(clean.toLowerCase()); unique.push({ ...item, title: clean });
        }
        allHeadlinesCache = unique;

        // 3. Geolocate RSS headlines
        const rssEvents = [];
        for (const item of unique) {
            const ev = geolocateHeadline(item.title);
            if (ev) { ev.pubDate = item.pubDate; ev.source = "rss"; rssEvents.push(ev); }
        }

        // 4. Fetch structured API sources + OSINT scraping in parallel
        const [gdeltEvents, osintEvents] = await Promise.allSettled([
            fetchGdeltEvents(),
            scrapeOsintSources(),
        ]);
        const gdelt = gdeltEvents.status === "fulfilled" ? gdeltEvents.value : [];
        const osint = osintEvents.status === "fulfilled" ? osintEvents.value : [];

        // 5. Fuse and deduplicate all sources
        const allLiveEvents = deduplicateEvents([...osint, ...gdelt, ...rssEvents]);
        liveEvents = allLiveEvents;

        console.log(`[CT] Sources: RSS=${rssEvents.length} GDELT=${gdelt.length} OSINT=${osint.length} ReliefWeb=${rwReports.length} → Fused=${allLiveEvents.length}`);
        return unique;
    }

    /* ══════════════════════════════════════════════════════════════════
     *  TICKER
     * ═════════════════════════════════════════════════════════════════*/
    function updateTicker(items) {
        const ticker = $("tickerContent");
        if (!items?.length) { ticker.innerHTML = `<span>${t("noNews")}</span>`; return; }
        const headlines = items.slice(0, 25).map(i => stripHtml(i.title));
        const html = headlines.map(h => `<span>${h}</span>`).join("");
        ticker.innerHTML = html + html;
    }

    /* ══════════════════════════════════════════════════════════════════
     *  MAP
     * ═════════════════════════════════════════════════════════════════*/
    let map = null;
    const layerGroups = {};
    const liveLayerGroup = {};
    let trajectoryLayer = null;
    const hiddenTypes = new Set();

    function initMap() {
        if (typeof L === "undefined") return;
        map = L.map("conflictMap", {
            center: [25, 30], zoom: 3, zoomControl: true, attributionControl: false,
            minZoom: 2, maxZoom: 12, worldCopyJump: true, tap: true, touchZoom: true,
        });
        L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", { subdomains: "abcd", maxZoom: 19 }).addTo(map);
        for (const type of Object.keys(TYPES)) { layerGroups[type] = L.layerGroup().addTo(map); liveLayerGroup[type] = L.layerGroup().addTo(map); }
        trajectoryLayer = L.layerGroup().addTo(map);
        addEventsToMap(BASELINE, false);
        renderTrajectories();
        // Close panel when clicking map background
        map.on("click", () => closeDetailPanel());
        setTimeout(() => map.invalidateSize(), 300);
    }

    function createMarker(ev, isLive) {
        const liveClass = isLive ? " mk-live" : "";
        const icon = L.divIcon({ html: `<div class="mk mk-${ev.t}${liveClass}"></div>`, className: "", iconSize: [16, 16], iconAnchor: [8, 8] });
        const marker = L.marker([ev.lat, ev.lng], { icon });
        // Click → open detail panel
        marker.on("click", (e) => { L.DomEvent.stopPropagation(e); openDetailPanel(ev, isLive); });
        return marker;
    }

    function addEventsToMap(events, isLive) {
        const target = isLive ? liveLayerGroup : layerGroups;
        events.forEach(ev => { if (!TYPES[ev.t]) return; target[ev.t].addLayer(createMarker(ev, isLive)); });
    }
    function clearLiveMarkers() { for (const type of Object.keys(TYPES)) liveLayerGroup[type].clearLayers(); }

    /* ── Trajectories ── */
    function curvePoints(from, to, segments = 30) {
        const pts = []; const midLat = (from[0] + to[0]) / 2; const midLng = (from[1] + to[1]) / 2;
        const dist = Math.sqrt((to[0] - from[0]) ** 2 + (to[1] - from[1]) ** 2);
        const dx = to[1] - from[1]; const dy = to[0] - from[0]; const nx = -dy; const ny = dx;
        const len = Math.sqrt(nx * nx + ny * ny) || 1; const off = dist * 0.2;
        const ctrlLat = midLat + (nx / len) * off; const ctrlLng = midLng + (ny / len) * off;
        for (let i = 0; i <= segments; i++) { const t = i / segments; const u = 1 - t; pts.push([u * u * from[0] + 2 * u * t * ctrlLat + t * t * to[0], u * u * from[1] + 2 * u * t * ctrlLng + t * t * to[1]]); }
        return pts;
    }
    function renderTrajectories() {
        if (!trajectoryLayer) return; trajectoryLayer.clearLayers();
        TRAJECTORIES.forEach(traj => {
            const pts = curvePoints(traj.from, traj.to);
            const line = L.polyline(pts, { color: traj.color, weight: 1.5, opacity: 0.5, dashArray: "8 6", className: "trajectory-line" });
            line.on("click", (e) => { L.DomEvent.stopPropagation(e); });
            trajectoryLayer.addLayer(line);
            const last = pts[pts.length - 1];
            const arrIcon = L.divIcon({ html: `<div style="width:6px;height:6px;background:${traj.color};border-radius:50%;box-shadow:0 0 6px ${traj.color}"></div>`, className: "", iconSize: [6, 6], iconAnchor: [3, 3] });
            trajectoryLayer.addLayer(L.marker(last, { icon: arrIcon, interactive: false }));
        });
    }

    /* ══════════════════════════════════════════════════════════════════
     *  DETAIL PANEL — World Monitor style
     * ═════════════════════════════════════════════════════════════════*/
    function openDetailPanel(ev, isLive) {
        const panel = $("detailPanel");

        // Badges
        const badges = $("detailBadges");
        badges.innerHTML = `
            <span class="badge badge-${ev.s}">${ev.s.toUpperCase()}</span>
            <span class="badge badge-${ev.t}">${tType(ev.t)}</span>
            ${isLive ? '<span class="badge badge-live">LIVE</span>' : ''}
        `;

        // Title & Region
        $("detailTitle").textContent = ev.n;
        $("detailRegion").textContent = ev.r;

        // Intel Summary
        const intel = INTEL[ev.r];
        const intelText = $("detailIntel");
        $("t-intel").textContent = t("intel");
        if (intel) {
            intelText.textContent = lang === "fr" ? intel.fr : intel.en;
        } else {
            intelText.textContent = lang === "fr"
                ? "Aucun résumé de renseignement disponible pour cette zone."
                : "No intelligence summary available for this zone.";
        }

        // Key Events in same region
        $("t-key-events").textContent = t("keyEvents");
        const evContainer = $("detailEvents");
        evContainer.innerHTML = "";
        const allEvs = [...BASELINE, ...liveEvents];
        const regionEvents = allEvs.filter(e => e.r === ev.r && e.n !== ev.n);
        if (regionEvents.length > 0) {
            $("eventsSection").style.display = "";
            regionEvents.forEach(re => {
                const chip = document.createElement("div");
                chip.className = "event-chip";
                chip.innerHTML = `<span class="ev-dot" style="background:${TYPES[re.t]?.color || '#888'}"></span>${re.n}`;
                chip.addEventListener("click", () => {
                    if (map) map.flyTo([re.lat, re.lng], 8, { duration: 0.8 });
                    openDetailPanel(re, !!re.live);
                });
                evContainer.appendChild(chip);
            });
        } else {
            $("eventsSection").style.display = "none";
        }

        // Related News
        $("t-related-news").textContent = t("relatedNews");
        const newsContainer = $("detailNews");
        newsContainer.innerHTML = "";
        const related = findRelatedNews(ev.r);
        if (related.length > 0) {
            related.forEach(item => {
                const div = document.createElement("div");
                div.className = "news-item";
                const timeStr = item.pubDate ? new Date(item.pubDate).toLocaleTimeString(lang, { hour: "2-digit", minute: "2-digit" }) : "";
                const dotColor = TYPES[geolocateHeadline(item.title)?.t]?.color || "#888";
                div.innerHTML = `
                    <span class="news-dot" style="background:${dotColor}"></span>
                    <div>
                        <div class="news-text">${stripHtml(item.title)}</div>
                        ${timeStr ? `<div class="news-time">${timeStr}</div>` : ""}
                    </div>
                `;
                newsContainer.appendChild(div);
            });
        } else {
            newsContainer.innerHTML = `<div class="news-empty">${t("noRelatedNews")}</div>`;
        }

        // Open panel
        panel.classList.add("open");
    }

    function closeDetailPanel() { $("detailPanel").classList.remove("open"); }
    $("detailClose").addEventListener("click", (e) => { e.stopPropagation(); closeDetailPanel(); });

    /* ══════════════════════════════════════════════════════════════════
     *  LEGEND
     * ═════════════════════════════════════════════════════════════════*/
    function renderLegend() {
        const container = $("legendItems"); container.innerHTML = "";
        for (const [type, cfg] of Object.entries(TYPES)) {
            const total = BASELINE.filter(e => e.t === type).length + liveEvents.filter(e => e.t === type).length;
            if (!total) continue;
            const item = document.createElement("div"); item.className = "legend-item" + (hiddenTypes.has(type) ? " dimmed" : "");
            item.innerHTML = `<span class="legend-dot" style="background:${cfg.color}"></span><span>${lang === "fr" ? cfg.fr : cfg.en}</span><span class="legend-count">${total}</span>`;
            item.addEventListener("click", () => toggleType(type)); container.appendChild(item);
        }
        const sep = document.createElement("div"); sep.className = "legend-sep"; container.appendChild(sep);
        const trajItem = document.createElement("div"); trajItem.className = "legend-traj";
        trajItem.innerHTML = `<span class="legend-traj-line"></span><span>${t("trajectories")}</span><span class="legend-count">${TRAJECTORIES.length}</span>`;
        container.appendChild(trajItem);
    }
    function toggleType(type) {
        if (hiddenTypes.has(type)) { hiddenTypes.delete(type); if (map) { map.addLayer(layerGroups[type]); map.addLayer(liveLayerGroup[type]); } }
        else { hiddenTypes.add(type); if (map) { map.removeLayer(layerGroups[type]); map.removeLayer(liveLayerGroup[type]); } }
        renderLegend(); renderStatsBar();
    }

    /* ══════════════════════════════════════════════════════════════════
     *  STATS BAR
     * ═════════════════════════════════════════════════════════════════*/
    function renderStatsBar() {
        const bar = $("statsBar"); bar.innerHTML = "";
        const chip0 = document.createElement("div"); chip0.className = "stat-chip";
        chip0.innerHTML = `<span class="cnt">${BASELINE.length + liveEvents.length}</span> ${t("events")}`;
        bar.appendChild(chip0);
        if (liveEvents.length) { const c = document.createElement("div"); c.className = "stat-chip"; c.innerHTML = `<span class="stat-live">${liveEvents.length}</span> ${t("liveEvents")}`; bar.appendChild(c); }
        for (const [type, cfg] of Object.entries(TYPES)) {
            const count = BASELINE.filter(e => e.t === type).length + liveEvents.filter(e => e.t === type).length;
            if (!count) continue;
            const c = document.createElement("div"); c.className = "stat-chip"; c.style.opacity = hiddenTypes.has(type) ? "0.3" : "1";
            c.innerHTML = `<span class="dot" style="background:${cfg.color}"></span><span class="cnt">${count}</span>`; bar.appendChild(c);
        }
    }

    /* ══════════════════════════════════════════════════════════════════
     *  CONFLICT TAGS
     * ═════════════════════════════════════════════════════════════════*/
    function renderConflictTags() {
        const list = $("conflictList"); list.innerHTML = "";
        const all = [...BASELINE, ...liveEvents]; const regions = new Map();
        all.forEach(ev => {
            if (!regions.has(ev.r)) regions.set(ev.r, { lat: ev.lat, lng: ev.lng, s: ev.s, count: 1, hasLive: !!ev.live });
            else { regions.get(ev.r).count++; if (ev.live) regions.get(ev.r).hasLive = true; }
        });
        for (const [name, d] of regions) {
            const tag = document.createElement("div"); tag.className = "conflict-tag";
            const sc = d.s === "critical" ? "sev-critical" : d.s === "high" ? "sev-high" : "sev-moderate";
            const li = d.hasLive ? ' <span style="color:var(--conflict);font-size:8px">●</span>' : '';
            tag.innerHTML = `<span class="sev ${sc}"></span>${name}${li} <span style="color:var(--text2);font-size:9px;margin-left:2px">${d.count}</span>`;
            tag.addEventListener("click", () => {
                if (map) map.flyTo([d.lat, d.lng], 6, { duration: 1.2 });
                // Also open detail panel for first event in this region
                const firstEv = all.find(e => e.r === name);
                if (firstEv) openDetailPanel(firstEv, !!firstEv.live);
            });
            list.appendChild(tag);
        }
    }

    /* ══════════════════════════════════════════════════════════════════
     *  LIVE UPDATE
     * ═════════════════════════════════════════════════════════════════*/
    function updateLiveTime() { $("liveTime").textContent = new Date().toLocaleTimeString(lang, { hour: "2-digit", minute: "2-digit", second: "2-digit" }); }
    async function refreshLive() {
        try {
            const headlines = await fetchLiveEvents(); updateTicker(headlines);
            clearLiveMarkers(); addEventsToMap(liveEvents, true);
            for (const type of hiddenTypes) { if (map && liveLayerGroup[type]) map.removeLayer(liveLayerGroup[type]); }
            renderLegend(); renderStatsBar(); renderConflictTags(); updateLiveTime(); updateDefcon();
        } catch (err) { console.warn("[CT] refresh error:", err); }
    }

    /* ══════════════════════════════════════════════════════════════════
     *  DEFCON — Synced with defconlevel.com OSINT estimate
     *  Fetches real estimated level, falls back to local analysis
     *  5=Low Peace  4=Increased  3=Elevated  2=High  1=Maximum
     * ═════════════════════════════════════════════════════════════════*/
    let cachedDefcon = null;
    let defconFetchTime = 0;
    const DEFCON_CACHE_MS = 30 * 60 * 1000; // Cache defcon level 30 min

    async function fetchDefconLevel() {
        // Multiple URLs to try (the site changed from .php to clean URLs)
        const urls = [
            "https://www.defconlevel.com/current-level",
            "https://www.defconlevel.com/",
            "https://defconlevel.com/current-level",
        ];
        // Multiple CORS proxies for maximum reliability
        const proxies = [
            u => `https://api.allorigins.win/raw?url=${encodeURIComponent(u)}`,
            u => `https://corsproxy.io/?url=${encodeURIComponent(u)}`,
            u => `https://thingproxy.freeboard.io/fetch/${u}`,
            u => `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(u)}`,
            u => `https://corsproxy.org/?${encodeURIComponent(u)}`,
        ];
        // Regex patterns to match defconlevel.com page structure
        const patterns = [
            /What\s+DEFCON\s+(\d)\s+Means/i,
            /Current\s*Level\s*(?:.*?)DEFCON\s*(\d)/is,
            /defcon-level\/(\d)/i,
            /OSINT\s+Estimate[\s\S]{0,200}DEFCON\s+(\d)/i,
            /class="[^"]*defcon-?(\d)/i,
            /DEFCON\s+(\d)/,
        ];
        for (const url of urls) {
            for (const mkProxy of proxies) {
                try {
                    const r = await fetchT(mkProxy(url));
                    if (!r.ok) continue;
                    const html = await r.text();
                    for (const pattern of patterns) {
                        const match = html.match(pattern);
                        if (match) {
                            const level = parseInt(match[1]);
                            if (level >= 1 && level <= 5) {
                                console.log(`[CT] DEFCON ${level} fetched from ${url} via proxy`);
                                return level;
                            }
                        }
                    }
                } catch { /* try next proxy */ }
            }
        }
        // Last resort: try Google search cache
        try {
            const googleUrl = `https://www.google.com/search?q=site:defconlevel.com+current+defcon+level`;
            const proxy = `https://api.allorigins.win/raw?url=${encodeURIComponent(googleUrl)}`;
            const r = await fetchT(proxy);
            if (r.ok) {
                const html = await r.text();
                const match = html.match(/DEFCON\s+(\d)/);
                if (match) {
                    const level = parseInt(match[1]);
                    if (level >= 1 && level <= 5) {
                        console.log(`[CT] DEFCON ${level} from Google cache`);
                        return level;
                    }
                }
            }
        } catch { /* Google cache also failed */ }
        console.log("[CT] DEFCON: all proxies failed, using local calculation");
        return null;
    }

    async function updateDefcon() {
        const now = Date.now();
        // Try to fetch from API if cache expired
        if (!cachedDefcon || now - defconFetchTime > DEFCON_CACHE_MS) {
            const fetched = await fetchDefconLevel();
            if (fetched && fetched >= 1 && fetched <= 5) {
                cachedDefcon = fetched;
                defconFetchTime = now;
            }
        }
        // Use fetched level or calculate locally
        const level = cachedDefcon || calculateLocalDefcon();
        // Update DOM
        const badge = $("defconBadge"); const label = $("defconLevel");
        badge.className = `defcon-badge defcon-${level}`;
        label.textContent = `DEFCON ${level}`;
    }

    function calculateLocalDefcon() {
        // Only analyze LIVE headlines, not baseline (baseline is permanent = always high)
        const titles = allHeadlinesCache.map(h => h.title.toLowerCase()).join(" ");
        let score = 0;
        // Nuclear keywords = immediate escalation
        const nukeKw = ["nuclear strike", "frappe nucléaire", "nuclear war", "guerre nucléaire", "thermonuclear", "nuclear launch", "tir nucléaire", "nuclear weapon used", "arme nucléaire utilisée"];
        for (const kw of nukeKw) { if (titles.includes(kw)) score += 60; }
        // ICBM / ballistic = high escalation (only specific terms, not generic "missile")
        const icbmKw = ["icbm", "intercontinental", "nuclear test", "essai nucléaire", "warhead", "ogive nucléaire", "nuclear arsenal"];
        for (const kw of icbmKw) { if (titles.includes(kw)) score += 25; }
        // Major escalation keywords
        const escalKw = ["world war", "guerre mondiale", "mobilisation générale", "nato article 5", "article 5", "martial law", "loi martiale"];
        for (const kw of escalKw) { if (titles.includes(kw)) score += 35; }
        // Baseline: any active conflict news = at least DEFCON 4
        if (titles.length > 200) score += 2;
        // Determine level — calibrated so normal conflict situation = DEFCON 3
        // DEFCON 2+ only with nuclear/ICBM/WW3 keywords
        if (score >= 120) return 1;
        if (score >= 60) return 2;
        if (score >= 2) return 3;
        if (score >= 1) return 4;
        return 5;
    }

    /* ── Resize ── */
    new MutationObserver(() => { if (map) setTimeout(() => map.invalidateSize(), 100); }).observe(document.body, { attributes: true, attributeFilter: ["class"] });
    window.addEventListener("resize", () => { if (map) setTimeout(() => map.invalidateSize(), 200); });

    /* ══════════════════════════════════════════════════════════════════
     *  INIT
     * ═════════════════════════════════════════════════════════════════*/
    applyTheme(theme); applyLang(lang);
    if (document.readyState === "complete" || document.readyState === "interactive") setTimeout(initMap, 100);
    else window.addEventListener("DOMContentLoaded", () => setTimeout(initMap, 100));
    renderLegend(); renderStatsBar(); renderConflictTags(); updateLiveTime();
    setTimeout(refreshLive, 1500);
    setInterval(refreshLive, 3 * 60 * 1000);
    setInterval(updateLiveTime, 1000);
})();
