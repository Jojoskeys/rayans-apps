// Contenu de l'arabe (arabe standard, vie courante) écrit pour l'app : mots et phrases avec voyelles courtes (harakat).
// Mots seuls à la forme « de pause » (sans la voyelle de cas finale) ; les verbes au passé, 3e personne (« il a écrit »),
// comme dans les dictionnaires. Transcription simple : ā ī ū = voyelles longues, ʾ = hamza, ʿ = ʿayn, ḥ ṣ ḍ ṭ ẓ = lettres
// emphatiques ou de gorge, kh gh sh th dh = une seule lettre arabe. Aucune citation coranique : seulement des formules
// de politesse de tous les jours. Les tests (test/contenu.test.ts) vérifient chaque ligne.

export interface MotAr {
  /** Écrit avec voyelles (sert aussi d'identifiant). */
  ar: string;
  tr: string;
  fr: string;
  theme: string;
  /** Racine trilitère (lettres séparées par des espaces), quand elle aide à voir les familles de mots. */
  racine?: string;
  /** Mot-clé en français (méthode du mot-clé) : un son proche + une image. */
  cle?: string;
}

export interface PhraseAr {
  /** Mots dans l'ordre (de droite à gauche à l'écran). */
  mots: string[];
  tr: string;
  fr: string;
  fin: string;
}

// mot | transcription | sens | thème | racine | mot-clé
const LIGNES = `
السَّلَامُ عَلَيْكُمْ|as-salāmu ʿalaykum|bonjour (la paix sur vous)|politesse|س ل م
وَعَلَيْكُمُ السَّلَامُ|wa ʿalaykumu s-salām|réponse : et sur vous la paix|politesse|س ل م
مَرْحَبًا|marḥaban|bonjour, bienvenue|politesse|ر ح ب
أَهْلًا|ahlan|salut, bienvenue|politesse
شُكْرًا|shukran|merci|politesse|ش ك ر
عَفْوًا|ʿafwan|de rien ; pardon|politesse|ع ف و
مِنْ فَضْلِكَ|min faḍlika|s'il te plaît (à un homme)|politesse|ف ض ل
مَعَ السَّلَامَةِ|maʿa s-salāma|au revoir|politesse|س ل م
صَبَاحُ الْخَيْرِ|ṣabāḥu l-khayr|bonjour (le matin)|politesse|ص ب ح
مَسَاءُ الْخَيْرِ|masāʾu l-khayr|bonsoir|politesse
إِنْ شَاءَ اللَّهُ|in shāʾa llāh|si Dieu le veut|politesse
الْحَمْدُ لِلَّهِ|al-ḥamdu li-llāh|Dieu merci (ça va bien)|politesse|ح م د
نَعَمْ|naʿam|oui|politesse
لَا|lā|non|politesse
آسِف|āsif|désolé (dit par un homme)|politesse|ء س ف
تَشَرَّفْنَا|tasharrafnā|enchanté|politesse|ش ر ف
كَيْفَ الْحَال|kayfa l-ḥāl|comment ça va ?|politesse|ح و ل
بِخَيْر|bi-khayr|bien (je vais bien)|politesse|خ ي ر
أَنَا|anā|je, moi|pronoms
أَنْتَ|anta|tu, toi (à un homme)|pronoms
أَنْتِ|anti|tu, toi (à une femme)|pronoms
هُوَ|huwa|il, lui|pronoms
هِيَ|hiya|elle|pronoms
نَحْنُ|naḥnu|nous|pronoms
أَنْتُمْ|antum|vous (plusieurs)|pronoms
هُمْ|hum|ils, eux|pronoms
مَا|mā|quoi ? (devant un nom)|questions
مَاذَا|mādhā|quoi ? (devant un verbe)|questions
مَنْ|man|qui ?|questions
أَيْنَ|ayna|où ?|questions
مَتَى|matā|quand ?|questions
كَيْفَ|kayfa|comment ?|questions
لِمَاذَا|limādhā|pourquoi ?|questions
كَمْ|kam|combien ?|questions
هَلْ|hal|est-ce que ?|questions
هَذَا|hādhā|ceci, celui-ci (masculin)|mots outils
هَذِهِ|hādhihi|ceci, celle-ci (féminin)|mots outils
ذَلِكَ|dhālika|cela (masculin)|mots outils
فِي|fī|dans|mots outils
عَلَى|ʿalā|sur|mots outils
مِنْ|min|de, depuis|mots outils
إِلَى|ilā|vers, à|mots outils
مَعَ|maʿa|avec|mots outils
وَ|wa|et|mots outils
أَوْ|aw|ou|mots outils
لَكِنْ|lākin|mais|mots outils
عِنْدَ|ʿinda|chez (عِنْدِي : j'ai)|mots outils
هُنَا|hunā|ici|mots outils
هُنَاكَ|hunāka|là-bas|mots outils
جِدًّا|jiddan|très|mots outils
كُلّ|kull|tout, chaque|mots outils
قَبْلَ|qabla|avant|mots outils
بَعْدَ|baʿda|après|mots outils
الْآنَ|al-āna|maintenant|mots outils
أَيْضًا|ayḍan|aussi|mots outils
فَقَطْ|faqaṭ|seulement|mots outils
كَثِير|kathīr|beaucoup, nombreux|mots outils|ك ث ر
قَلِيل|qalīl|peu|mots outils|ق ل ل
أَب|ab|père|famille|ء ب و
أُمّ|umm|mère|famille||« hum » : « hum, ça sent bon, c'est maman qui cuisine ».
أَخ|akh|frère|famille|ء خ و
أُخْت|ukht|sœur|famille|ء خ و
اِبْن|ibn|fils|famille|ب ن ي
بِنْت|bint|fille|famille|ب ن ي
جَدّ|jadd|grand-père|famille|ج د د
جَدَّة|jadda|grand-mère|famille|ج د د
زَوْج|zawj|mari|famille|ز و ج
زَوْجَة|zawja|épouse|famille|ز و ج
عَائِلَة|ʿāʾila|famille|famille|ع و ل
طِفْل|ṭifl|enfant|famille|ط ف ل|« trèfle » : un enfant qui cherche un trèfle à quatre feuilles.
وَلَد|walad|garçon, enfant|famille|و ل د
رَجُل|rajul|homme|famille|ر ج ل
اِمْرَأَة|imraʾa|femme|famille|م ر ء
صَدِيق|ṣadīq|ami|famille|ص د ق
صَدِيقَة|ṣadīqa|amie|famille|ص د ق
جَار|jār|voisin|famille|ج و ر
مُعَلِّم|muʿallim|professeur|métiers|ع ل م
مُدَرِّس|mudarris|enseignant|métiers|د ر س
طَالِب|ṭālib|étudiant|métiers|ط ل ب
طَبِيب|ṭabīb|médecin|métiers|ط ب ب
مُهَنْدِس|muhandis|ingénieur|métiers
طَبَّاخ|ṭabbākh|cuisinier|métiers|ط ب خ
تَاجِر|tājir|commerçant|métiers|ت ج ر
كَاتِب|kātib|écrivain|métiers|ك ت ب
سَائِق|sāʾiq|chauffeur|métiers|س و ق
وَاحِد|wāḥid|un (1)|nombres|و ح د
اِثْنَان|ithnān|deux (2)|nombres|ث ن ي
ثَلَاثَة|thalātha|trois (3)|nombres|ث ل ث
أَرْبَعَة|arbaʿa|quatre (4)|nombres|ر ب ع
خَمْسَة|khamsa|cinq (5)|nombres|خ م س
سِتَّة|sitta|six (6)|nombres
سَبْعَة|sabʿa|sept (7)|nombres|س ب ع
ثَمَانِيَة|thamāniya|huit (8)|nombres|ث م ن
تِسْعَة|tisʿa|neuf (9)|nombres|ت س ع
عَشَرَة|ʿashara|dix (10)|nombres|ع ش ر
صِفْر|ṣifr|zéro|nombres
مِئَة|miʾa|cent|nombres
أَلْف|alf|mille|nombres
يَوْم|yawm|jour|temps|ي و م
لَيْلَة|layla|nuit|temps|ل ي ل
أُسْبُوع|usbūʿ|semaine|temps|س ب ع
شَهْر|shahr|mois|temps|ش ه ر
سَنَة|sana|année|temps
سَاعَة|sāʿa|heure ; montre|temps
دَقِيقَة|daqīqa|minute|temps|د ق ق
الْيَوْمَ|al-yawm|aujourd'hui|temps|ي و م
غَدًا|ghadan|demain|temps
أَمْسِ|amsi|hier|temps
صَبَاح|ṣabāḥ|matin|temps|ص ب ح
مَسَاء|masāʾ|soir|temps
ظُهْر|ẓuhr|midi|temps
وَقْت|waqt|temps, moment|temps|و ق ت
يَوْمُ الْجُمُعَةِ|yawmu l-jumuʿa|vendredi|temps|ج م ع
السَّبْت|as-sabt|samedi|temps
الْأَحَد|al-aḥad|dimanche|temps|ء ح د
الِاثْنَيْن|al-ithnayn|lundi|temps|ث ن ي
الثُّلَاثَاء|ath-thulāthāʾ|mardi|temps|ث ل ث
الْأَرْبِعَاء|al-arbiʿāʾ|mercredi|temps|ر ب ع
الْخَمِيس|al-khamīs|jeudi|temps|خ م س
بَيْت|bayt|maison|lieux|ب ي ت|« bête » : une bête énorme assise devant ta maison.
غُرْفَة|ghurfa|chambre, pièce|lieux|غ ر ف
مَطْبَخ|maṭbakh|cuisine (la pièce)|lieux|ط ب خ
مَدْرَسَة|madrasa|école|lieux|د ر س
جَامِعَة|jāmiʿa|université|lieux|ج م ع
مَسْجِد|masjid|mosquée|lieux|س ج د
سُوق|sūq|marché|lieux|س و ق|« souk » : le mot est déjà passé en français.
مَطْعَم|maṭʿam|restaurant|lieux|ط ع م
مُسْتَشْفَى|mustashfā|hôpital|lieux|ش ف ي
مَكْتَب|maktab|bureau|lieux|ك ت ب
مَكْتَبَة|maktaba|bibliothèque, librairie|lieux|ك ت ب
مَدِينَة|madīna|ville|lieux
شَارِع|shāriʿ|rue|lieux|ش ر ع
بَلَد|balad|pays|lieux|ب ل د
مَطَار|maṭār|aéroport|lieux|ط ي ر
بَحْر|baḥr|mer|lieux|ب ح ر|« bar » : un petit bar au bord de la mer.
بَاب|bāb|porte|lieux||« baba » : un baba au miel coincé dans la porte.
نَافِذَة|nāfidha|fenêtre|lieux|ن ف ذ
حَدِيقَة|ḥadīqa|jardin|lieux
فُنْدُق|funduq|hôtel|lieux
مَحَطَّة|maḥaṭṭa|gare, station|lieux|ح ط ط
مَلْعَب|malʿab|terrain de jeu, stade|lieux|ل ع ب
حَمَّام|ḥammām|salle de bain, toilettes|lieux
مَاء|māʾ|eau|nourriture
خُبْز|khubz|pain|nourriture|خ ب ز
حَلِيب|ḥalīb|lait|nourriture|ح ل ب
شَاي|shāy|thé|nourriture
قَهْوَة|qahwa|café|nourriture
لَحْم|laḥm|viande|nourriture|ل ح م|« lame » : tu coupes la viande avec une lame.
دَجَاج|dajāj|poulet|nourriture
سَمَك|samak|poisson|nourriture
أَرُزّ|aruzz|riz|nourriture
تُفَّاح|tuffāḥ|pommes|nourriture
بُرْتُقَال|burtuqāl|orange (le fruit)|nourriture
مَوْز|mawz|bananes|nourriture
تَمْر|tamr|dattes|nourriture
بَيْض|bayḍ|œufs|nourriture
جُبْن|jubn|fromage|nourriture
سُكَّر|sukkar|sucre|nourriture
مِلْح|milḥ|sel|nourriture
خُضَار|khuḍār|légumes|nourriture|خ ض ر
فَاكِهَة|fākiha|fruit|nourriture
طَعَام|ṭaʿām|nourriture|nourriture|ط ع م
فُطُور|fuṭūr|petit-déjeuner|nourriture|ف ط ر
غَدَاء|ghadāʾ|déjeuner|nourriture
عَشَاء|ʿashāʾ|dîner|nourriture
عَصِير|ʿaṣīr|jus|nourriture|ع ص ر
زَيْت|zayt|huile|nourriture
مَشْرُوب|mashrūb|boisson|nourriture|ش ر ب
لَذِيذ|ladhīdh|délicieux|nourriture|ل ذ ذ
كِتَاب|kitāb|livre|objets|ك ت ب
قَلَم|qalam|stylo|objets||« calme » : écrire au stylo, ça rend calme.
دَفْتَر|daftar|cahier|objets
وَرَقَة|waraqa|feuille (de papier)|objets|و ر ق
حَقِيبَة|ḥaqība|sac|objets
كُرْسِيّ|kursiyy|chaise|objets
طَاوِلَة|ṭāwila|table|objets
سَرِير|sarīr|lit|objets
هَاتِف|hātif|téléphone|objets
سَيَّارَة|sayyāra|voiture|objets|س ي ر
مِفْتَاح|miftāḥ|clé|objets|ف ت ح
مَال|māl|argent|objets||« malle » : une malle remplie d'argent.
مَلَابِس|malābis|vêtements|objets|ل ب س
قَمِيص|qamīṣ|chemise|objets
حِذَاء|ḥidhāʾ|chaussure|objets
نَظَّارَة|naẓẓāra|lunettes|objets|ن ظ ر
كُرَة|kura|ballon|objets||« cour » : un ballon qui rebondit dans la cour.
صُورَة|ṣūra|image, photo|objets
رِسَالَة|risāla|lettre, message|objets|ر س ل
قِطَار|qiṭār|train|objets|ق ط ر
طَائِرَة|ṭāʾira|avion|objets|ط ي ر
لُغَة|lugha|langue (qu'on parle)|langue
كَلِمَة|kalima|mot|langue|ك ل م
جُمْلَة|jumla|phrase|langue|ج م ل
سُؤَال|suʾāl|question|langue|س ء ل
جَوَاب|jawāb|réponse|langue|ج و ب
دَرْس|dars|leçon|langue|د ر س
اِسْم|ism|nom|langue|س م و
عَمَل|ʿamal|travail|langue|ع م ل
عِلْم|ʿilm|science, savoir|langue|ع ل م
سَفَر|safar|voyage|langue|س ف ر
الْعَرَبِيَّة|al-ʿarabiyya|la langue arabe|langue|ع ر ب
رَأْس|raʾs|tête|corps|ر ء س
عَيْن|ʿayn|œil|corps|ع ي ن
يَد|yad|main|corps
رِجْل|rijl|jambe, pied|corps|ر ج ل
قَلْب|qalb|cœur|corps|ق ل ب|« galbe » : le joli galbe d'un cœur dessiné.
فَم|fam|bouche|corps||« femme » : une femme qui ouvre grand la bouche.
أُذُن|udhun|oreille|corps
وَجْه|wajh|visage|corps|و ج ه
أَنْف|anf|nez|corps
شَعْر|shaʿr|cheveux|corps|ش ع ر
شَمْس|shams|soleil|nature||« champs » : le soleil brille sur les champs.
قَمَر|qamar|lune|nature||« camarade » : ton camarade regarde la lune.
سَمَاء|samāʾ|ciel|nature
مَطَر|maṭar|pluie|nature|م ط ر
أَرْض|arḍ|terre, sol|nature
شَجَرَة|shajara|arbre|nature|ش ج ر
وَرْدَة|warda|rose (la fleur)|nature||« regarde » : « regarde cette rose ! »
جَبَل|jabal|montagne|nature
نَهْر|nahr|fleuve, rivière|nature
طَقْس|ṭaqs|météo|nature
قِطّ|qiṭṭ|chat|nature||« kit » : un chat qui joue avec un kit de couture.
كَلْب|kalb|chien|nature||« calepin » : un chien qui mâchouille ton calepin.
حِصَان|ḥiṣān|cheval|nature||« hisser » : tu te hisses sur le cheval.
جَمَل|jamal|chameau|nature||« j'ai mal » : « j'ai mal au dos sur ce chameau ! »
طَائِر|ṭāʾir|oiseau|nature|ط ي ر
بَقَرَة|baqara|vache|nature
أَبْيَض|abyaḍ|blanc|couleurs|ب ي ض
أَسْوَد|aswad|noir|couleurs|س و د
أَحْمَر|aḥmar|rouge|couleurs|ح م ر
أَخْضَر|akhḍar|vert|couleurs|خ ض ر
أَزْرَق|azraq|bleu|couleurs|ز ر ق
أَصْفَر|aṣfar|jaune|couleurs|ص ف ر
كَبِير|kabīr|grand|adjectifs|ك ب ر
صَغِير|ṣaghīr|petit|adjectifs|ص غ ر
جَدِيد|jadīd|nouveau, neuf|adjectifs|ج د د
قَدِيم|qadīm|ancien, vieux|adjectifs|ق د م
جَمِيل|jamīl|beau|adjectifs|ج م ل
طَوِيل|ṭawīl|long ; grand (de taille)|adjectifs|ط و ل
قَصِير|qaṣīr|court ; petit (de taille)|adjectifs|ق ص ر
حَارّ|ḥārr|chaud|adjectifs|ح ر ر
بَارِد|bārid|froid|adjectifs|ب ر د
سَهْل|sahl|facile|adjectifs|س ه ل|« sel » : mettre du sel, c'est facile.
صَعْب|ṣaʿb|difficile|adjectifs|ص ع ب|« sabre » : manier le sabre, c'est difficile.
سَرِيع|sarīʿ|rapide|adjectifs|س ر ع
بَطِيء|baṭīʾ|lent|adjectifs|ب ط ء
قَرِيب|qarīb|proche|adjectifs|ق ر ب
بَعِيد|baʿīd|loin|adjectifs|ب ع د
جَيِّد|jayyid|bon, bien|adjectifs
سَعِيد|saʿīd|heureux|adjectifs|س ع د
حَزِين|ḥazīn|triste|adjectifs|ح ز ن
مُتْعَب|mutʿab|fatigué|adjectifs|ت ع ب
جَائِع|jāʾiʿ|qui a faim|adjectifs|ج و ع
عَطْشَان|ʿaṭshān|qui a soif|adjectifs|ع ط ش
مَشْغُول|mashghūl|occupé|adjectifs|ش غ ل
رَخِيص|rakhīṣ|bon marché|adjectifs|ر خ ص
نَظِيف|naẓīf|propre|adjectifs|ن ظ ف
مَفْتُوح|maftūḥ|ouvert|adjectifs|ف ت ح
مُغْلَق|mughlaq|fermé|adjectifs|غ ل ق
كَتَبَ|kataba|écrire (il a écrit)|verbes|ك ت ب
قَرَأَ|qaraʾa|lire (il a lu)|verbes|ق ر ء
ذَهَبَ|dhahaba|aller (il est allé)|verbes|ذ ه ب
جَاءَ|jāʾa|venir (il est venu)|verbes|ج ي ء
أَكَلَ|akala|manger (il a mangé)|verbes|ء ك ل
شَرِبَ|shariba|boire (il a bu)|verbes|ش ر ب
نَامَ|nāma|dormir (il a dormi)|verbes|ن و م
دَرَسَ|darasa|étudier (il a étudié)|verbes|د ر س
عَمِلَ|ʿamila|travailler (il a travaillé)|verbes|ع م ل
فَتَحَ|fataḥa|ouvrir (il a ouvert)|verbes|ف ت ح
جَلَسَ|jalasa|s'asseoir (il s'est assis)|verbes|ج ل س
خَرَجَ|kharaja|sortir (il est sorti)|verbes|خ ر ج
دَخَلَ|dakhala|entrer (il est entré)|verbes|د خ ل
سَمِعَ|samiʿa|entendre (il a entendu)|verbes|س م ع
رَأَى|raʾā|voir (il a vu)|verbes|ر ء ي
قَالَ|qāla|dire (il a dit)|verbes|ق و ل
عَرَفَ|ʿarafa|savoir, connaître (il a su)|verbes|ع ر ف
فَهِمَ|fahima|comprendre (il a compris)|verbes|ف ه م
أَحَبَّ|aḥabba|aimer (il a aimé)|verbes|ح ب ب
أَرَادَ|arāda|vouloir (il a voulu)|verbes|ر و د
سَكَنَ|sakana|habiter (il a habité)|verbes|س ك ن
رَجَعَ|rajaʿa|revenir (il est revenu)|verbes|ر ج ع
لَعِبَ|laʿiba|jouer (il a joué)|verbes|ل ع ب
طَبَخَ|ṭabakha|cuisiner (il a cuisiné)|verbes|ط ب خ
غَسَلَ|ghasala|laver (il a lavé)|verbes|غ س ل
سَافَرَ|sāfara|voyager (il a voyagé)|verbes|س ف ر
اِشْتَرَى|ishtarā|acheter (il a acheté)|verbes|ش ر ي
بَاعَ|bāʿa|vendre (il a vendu)|verbes|ب ي ع
سَأَلَ|saʾala|demander (il a demandé)|verbes|س ء ل
أَعْطَى|aʿṭā|donner (il a donné)|verbes|ع ط و
أَخَذَ|akhadha|prendre (il a pris)|verbes|ء خ ذ
وَجَدَ|wajada|trouver (il a trouvé)|verbes|و ج د
نَسِيَ|nasiya|oublier (il a oublié)|verbes|ن س ي
تَعَلَّمَ|taʿallama|apprendre (il a appris)|verbes|ع ل م
عَلَّمَ|ʿallama|enseigner (il a enseigné)|verbes|ع ل م
سَاعَدَ|sāʿada|aider (il a aidé)|verbes|س ع د
اِنْتَظَرَ|intaẓara|attendre (il a attendu)|verbes|ن ظ ر
نَظَرَ|naẓara|regarder (il a regardé)|verbes|ن ظ ر
مَشَى|mashā|marcher (il a marché)|verbes|م ش ي
رَكِبَ|rakiba|monter dans un véhicule (il est monté)|verbes|ر ك ب
وَصَلَ|waṣala|arriver (il est arrivé)|verbes|و ص ل
بَدَأَ|badaʾa|commencer (il a commencé)|verbes|ب د ء
ضَحِكَ|ḍaḥika|rire (il a ri)|verbes|ض ح ك
بَكَى|bakā|pleurer (il a pleuré)|verbes|ب ك ي
لَبِسَ|labisa|s'habiller (il a mis un vêtement)|verbes|ل ب س
اِسْتَيْقَظَ|istayqaẓa|se réveiller (il s'est réveillé)|verbes|ي ق ظ
صَلَّى|ṣallā|prier (il a prié)|verbes|ص ل و
تَكَلَّمَ|takallama|parler (il a parlé)|verbes|ك ل م
سَبَحَ|sabaḥa|nager (il a nagé)|verbes|س ب ح
رَكَضَ|rakaḍa|courir (il a couru)|verbes|ر ك ض
`;

export const MOTS_AR: MotAr[] = LIGNES.trim().split("\n").map((l) => {
  const [ar, tr, fr, theme, racine, cle] = l.split("|");
  return { ar, tr, fr, theme, ...(racine ? { racine } : {}), ...(cle ? { cle } : {}) };
});

// mots (séparés par des espaces) | transcription | traduction | ponctuation finale
const PHRASES = `
أَنَا طَالِبٌ|anā ṭālib|Je suis étudiant.|.
هُوَ مُعَلِّمٌ|huwa muʿallim|Il est professeur.|.
هِيَ طَبِيبَةٌ|hiya ṭabība|Elle est médecin.|.
اِسْمِي كَرِيمٌ|ismī karīm|Je m'appelle Karim.|.
أَيْنَ الْمَسْجِدُ|ayna l-masjid|Où est la mosquée ?|؟
الْبَيْتُ كَبِيرٌ|al-baytu kabīr|La maison est grande.|.
الْكِتَابُ جَدِيدٌ|al-kitābu jadīd|Le livre est neuf.|.
هَذَا قَلَمٌ|hādhā qalam|C'est un stylo.|.
هَذِهِ سَيَّارَةٌ|hādhihi sayyāra|C'est une voiture.|.
أُحِبُّ الشَّايَ|uḥibbu sh-shāy|J'aime le thé.|.
أَشْرَبُ الْمَاءَ|ashrabu l-māʾ|Je bois de l'eau.|.
آكُلُ الْخُبْزَ|ākulu l-khubz|Je mange du pain.|.
أَيْنَ تَسْكُنُ|ayna taskun|Où habites-tu ?|؟
أَسْكُنُ فِي بَارِيسَ|askunu fī bārīs|J'habite à Paris.|.
كَيْفَ حَالُكَ|kayfa ḥāluk|Comment vas-tu ?|؟
أَنَا بِخَيْرٍ|anā bi-khayr|Je vais bien.|.
الْجَوُّ حَارٌّ الْيَوْمَ|al-jawwu ḥārrun l-yawm|Il fait chaud aujourd'hui.|.
الْمَاءُ بَارِدٌ|al-māʾu bārid|L'eau est froide.|.
أَذْهَبُ إِلَى الْمَدْرَسَةِ|adhhabu ilā l-madrasa|Je vais à l'école.|.
هُوَ فِي الْبَيْتِ|huwa fī l-bayt|Il est à la maison.|.
الْقِطُّ صَغِيرٌ|al-qiṭṭu ṣaghīr|Le chat est petit.|.
عِنْدِي أَخٌ وَأُخْتٌ|ʿindī akhun wa ukht|J'ai un frère et une sœur.|.
أُمِّي فِي الْمَطْبَخِ|ummī fī l-maṭbakh|Ma mère est dans la cuisine.|.
أَبِي يَعْمَلُ فِي مَكْتَبٍ|abī yaʿmalu fī maktab|Mon père travaille dans un bureau.|.
أَنَا جَائِعٌ|anā jāʾiʿ|J'ai faim.|.
أُرِيدُ قَهْوَةً|urīdu qahwa|Je voudrais un café.|.
مَا اسْمُكَ|mā smuk|Comment t'appelles-tu ?|؟
مِنْ أَيْنَ أَنْتَ|min ayna anta|D'où viens-tu ?|؟
أَنَا مِنْ فَرَنْسَا|anā min faransā|Je viens de France.|.
كَمِ السَّاعَةُ|kami s-sāʿa|Quelle heure est-il ?|؟
الْمَطْعَمُ قَرِيبٌ|al-maṭʿamu qarīb|Le restaurant est proche.|.
الْمَطَارُ بَعِيدٌ|al-maṭāru baʿīd|L'aéroport est loin.|.
هَذَا سَهْلٌ|hādhā sahl|C'est facile.|.
الدَّرْسُ صَعْبٌ|ad-darsu ṣaʿb|La leçon est difficile.|.
أَنَا لَا أَفْهَمُ|anā lā afham|Je ne comprends pas.|.
هَلْ تَتَكَلَّمُ الْعَرَبِيَّةَ|hal tatakallamu l-ʿarabiyya|Est-ce que tu parles arabe ?|؟
أَتَعَلَّمُ الْعَرَبِيَّةَ|ataʿallamu l-ʿarabiyya|J'apprends l'arabe.|.
أَقْرَأُ كِتَابًا|aqraʾu kitābā|Je lis un livre.|.
هِيَ تَكْتُبُ رِسَالَةً|hiya taktubu risāla|Elle écrit une lettre.|.
نَحْنُ فِي السُّوقِ|naḥnu fī s-sūq|Nous sommes au marché.|.
الْبَابُ مَفْتُوحٌ|al-bābu maftūḥ|La porte est ouverte.|.
النَّافِذَةُ مُغْلَقَةٌ|an-nāfidhatu mughlaqa|La fenêtre est fermée.|.
السَّمَاءُ زَرْقَاءُ|as-samāʾu zarqāʾ|Le ciel est bleu.|.
الشَّمْسُ حَارَّةٌ|ash-shamsu ḥārra|Le soleil est chaud.|.
أَنَامُ فِي اللَّيْلِ|anāmu fī l-layl|Je dors la nuit.|.
أَسْتَيْقِظُ مُبَكِّرًا|astayqiẓu mubakkirā|Je me réveille tôt.|.
أُصَلِّي الْفَجْرَ|uṣallī l-fajr|Je prie Fajr.|.
نَذْهَبُ إِلَى الْمَسْجِدِ يَوْمَ الْجُمُعَةِ|nadhhabu ilā l-masjidi yawma l-jumuʿa|Nous allons à la mosquée le vendredi.|.
الطَّعَامُ لَذِيذٌ|aṭ-ṭaʿāmu ladhīdh|La nourriture est délicieuse.|.
أُحِبُّ التَّمْرَ وَالْحَلِيبَ|uḥibbu t-tamra wa l-ḥalīb|J'aime les dattes et le lait.|.
أَخِي طَوِيلٌ|akhī ṭawīl|Mon frère est grand.|.
أُخْتِي سَعِيدَةٌ|ukhtī saʿīda|Ma sœur est heureuse.|.
صَدِيقِي مَشْغُولٌ|ṣadīqī mashghūl|Mon ami est occupé.|.
أَنَا مُتْعَبٌ قَلِيلًا|anā mutʿabun qalīlā|Je suis un peu fatigué.|.
شُكْرًا جَزِيلًا|shukran jazīlā|Merci beaucoup.|!
لَا مُشْكِلَةَ|lā mushkila|Pas de problème.|.
أَيْنَ الْحَمَّامُ|ayna l-ḥammām|Où sont les toilettes ?|؟
كَمْ ثَمَنُ هَذَا|kam thamanu hādhā|Combien coûte ceci ?|؟
هَذَا رَخِيصٌ|hādhā rakhīṣ|C'est bon marché.|.
أُرِيدُ أَنْ أُسَافِرَ|urīdu an usāfir|Je veux voyager.|.
أَرْكَبُ السَّيَّارَةَ|arkabu s-sayyāra|Je monte en voiture.|.
الْقِطَارُ سَرِيعٌ|al-qiṭāru sarīʿ|Le train est rapide.|.
الْحِصَانُ جَمِيلٌ|al-ḥiṣānu jamīl|Le cheval est beau.|.
عِنْدِي كَلْبٌ|ʿindī kalb|J'ai un chien.|.
أَيْنَ حَقِيبَتِي|ayna ḥaqībatī|Où est mon sac ?|؟
الْمِفْتَاحُ عَلَى الطَّاوِلَةِ|al-miftāḥu ʿalā ṭ-ṭāwila|La clé est sur la table.|.
الْكُرْسِيُّ فِي الْغُرْفَةِ|al-kursiyyu fī l-ghurfa|La chaise est dans la chambre.|.
أَغْسِلُ يَدَيَّ|aghsilu yadayy|Je me lave les mains.|.
رَأْسِي يُؤْلِمُنِي|raʾsī yuʾlimunī|J'ai mal à la tête.|.
أَذْهَبُ إِلَى الطَّبِيبِ|adhhabu ilā ṭ-ṭabīb|Je vais chez le médecin.|.
الْمُسْتَشْفَى قَرِيبٌ|al-mustashfā qarīb|L'hôpital est proche.|.
أَلْعَبُ كُرَةَ الْقَدَمِ|alʿabu kurata l-qadam|Je joue au football.|.
نَحْنُ أَصْدِقَاءُ|naḥnu aṣdiqāʾ|Nous sommes amis.|.
أَهْلًا وَسَهْلًا|ahlan wa sahlā|Bienvenue !|!
إِلَى اللِّقَاءِ|ilā l-liqāʾ|À bientôt.|.
تُصْبِحُ عَلَى خَيْرٍ|tuṣbiḥu ʿalā khayr|Bonne nuit (à un homme).|.
أَنَا آسِفٌ|anā āsif|Je suis désolé.|.
مَاذَا تُرِيدُ|mādhā turīd|Que veux-tu ?|؟
مَتَى تَرْجِعُ|matā tarjiʿ|Quand reviens-tu ?|؟
أَرْجِعُ غَدًا|arjiʿu ghadā|Je reviens demain.|.
الْيَوْمُ يَوْمٌ جَمِيلٌ|al-yawmu yawmun jamīl|Aujourd'hui est une belle journée.|.
أَشْرَبُ الشَّايَ فِي الصَّبَاحِ|ashrabu sh-shāya fī ṣ-ṣabāḥ|Je bois du thé le matin.|.
`;

export const PHRASES_AR: PhraseAr[] = PHRASES.trim().split("\n").map((l) => {
  const [m, tr, fr, fin] = l.split("|");
  return { mots: m.split(" "), tr, fr, fin };
});
