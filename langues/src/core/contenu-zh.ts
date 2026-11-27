// Contenu du chinois mandarin (niveau HSK 1-2) écrit pour l'app : mots, phrases, radicaux, syllabes pour les tons.
// Caractères simplifiés ; pinyin avec une syllabe par caractère, séparées par des espaces, tons en accents
// (pas d'accent = ton neutre). 一 et 不 sont écrits avec le ton qu'on prononce dans le mot (一起 yì qǐ, 不客气 bú kè qi),
// comme dans les manuels HSK. Les tests (test/contenu.test.ts) vérifient chaque ligne.

export interface MotZh {
  /** Caractères simplifiés (sert aussi d'identifiant). */
  hz: string;
  py: string;
  fr: string;
  theme: string;
  /** Radical principal (clé de RADICAUX), quand il aide à retenir. */
  radical?: string;
  /** Mot-clé en français (méthode du mot-clé) : un son proche + une image. */
  cle?: string;
}

export interface PhraseZh {
  /** Mots, dans l'ordre (sert à l'exercice « remettre dans l'ordre »). */
  mots: string[];
  /** Pinyin de chaque mot (même nombre). */
  py: string[];
  fr: string;
  /** Ponctuation finale. */
  fin: string;
}

// hz | pinyin | sens | thème | radical | mot-clé
const LIGNES = `
你好|nǐ hǎo|bonjour|politesse
您|nín|vous (forme polie)|politesse|心
谢谢|xiè xie|merci|politesse|讠
不客气|bú kè qi|de rien|politesse
对不起|duì bu qǐ|pardon, désolé|politesse
没关系|méi guān xi|ce n'est pas grave|politesse
再见|zài jiàn|au revoir|politesse
请|qǐng|s'il te plaît ; inviter|politesse|讠
欢迎|huān yíng|bienvenue|politesse
我|wǒ|je, moi|personnes
你|nǐ|tu, toi|personnes|亻
他|tā|il, lui|personnes|亻
她|tā|elle|personnes|女
它|tā|il, elle (objet, animal)|personnes
我们|wǒ men|nous|personnes
你们|nǐ men|vous (plusieurs)|personnes
他们|tā men|ils, eux|personnes
人|rén|personne, gens|personnes
朋友|péng you|ami|personnes
老师|lǎo shī|professeur|personnes
学生|xué sheng|élève, étudiant|personnes
同学|tóng xué|camarade de classe|personnes
医生|yī shēng|médecin|personnes
先生|xiān sheng|monsieur|personnes
小姐|xiǎo jiě|mademoiselle|personnes|女
孩子|hái zi|enfant|personnes
男人|nán rén|homme|personnes
女人|nǚ rén|femme|personnes|女
服务员|fú wù yuán|serveur, serveuse|personnes
名字|míng zi|nom, prénom|personnes
爸爸|bà ba|papa|famille
妈妈|mā ma|maman|famille|女|« mama » : ça sonne déjà comme « maman ».
哥哥|gē ge|grand frère|famille
姐姐|jiě jie|grande sœur|famille|女
弟弟|dì di|petit frère|famille
妹妹|mèi mei|petite sœur|famille|女
儿子|ér zi|fils|famille
女儿|nǚ ér|fille (son enfant)|famille|女
丈夫|zhàng fu|mari|famille
妻子|qī zi|épouse|famille|女
家|jiā|maison, famille|famille
一|yī|un (1)|nombres
二|èr|deux (2)|nombres
三|sān|trois (3)|nombres
四|sì|quatre (4)|nombres
五|wǔ|cinq (5)|nombres
六|liù|six (6)|nombres
七|qī|sept (7)|nombres
八|bā|huit (8)|nombres
九|jiǔ|neuf (9)|nombres
十|shí|dix (10)|nombres
百|bǎi|cent|nombres
千|qiān|mille|nombres
零|líng|zéro|nombres
两|liǎng|deux (devant un classificateur)|nombres
第一|dì yī|premier|nombres
个|gè|(classificateur le plus courant)|classificateurs
本|běn|(classificateur des livres)|classificateurs|木
件|jiàn|(classificateur des vêtements, des affaires)|classificateurs|亻
岁|suì|an (pour l'âge)|classificateurs
次|cì|fois|classificateurs
些|xiē|quelques|classificateurs
块|kuài|yuan (unité d'argent, à l'oral)|classificateurs
口|kǒu|bouche ; (classificateur des membres d'une famille)|classificateurs|口
今天|jīn tiān|aujourd'hui|temps
明天|míng tiān|demain|temps|日
昨天|zuó tiān|hier|temps|日
今年|jīn nián|cette année|temps
去年|qù nián|l'année dernière|temps
年|nián|année|temps
月|yuè|mois ; lune|temps
号|hào|jour du mois ; numéro|temps|口
星期|xīng qī|semaine|temps|日
天|tiān|jour ; ciel|temps
点|diǎn|heure (sur l'horloge) ; un peu|temps
分钟|fēn zhōng|minute|temps
小时|xiǎo shí|heure (durée)|temps|日
现在|xiàn zài|maintenant|temps
时候|shí hou|moment|temps|日
早上|zǎo shang|matin|temps|日
上午|shàng wǔ|matinée|temps
中午|zhōng wǔ|midi|temps
下午|xià wǔ|après-midi|temps
晚上|wǎn shang|soir|temps|日
时间|shí jiān|temps (durée)|temps|日
生日|shēng rì|anniversaire|temps
已经|yǐ jīng|déjà|temps
每天|měi tiān|chaque jour|temps
中国|zhōng guó|Chine|lieux
北京|běi jīng|Pékin|lieux
法国|fǎ guó|France|lieux|氵
学校|xué xiào|école|lieux|木
医院|yī yuàn|hôpital|lieux
商店|shāng diàn|magasin|lieux
饭馆|fàn guǎn|restaurant|lieux|饣
饭店|fàn diàn|restaurant, hôtel|lieux|饣
宾馆|bīn guǎn|hôtel|lieux
机场|jī chǎng|aéroport|lieux|木
火车站|huǒ chē zhàn|gare|lieux
公司|gōng sī|entreprise|lieux
房间|fáng jiān|chambre, pièce|lieux
教室|jiào shì|salle de classe|lieux
路|lù|route, chemin|lieux|足|« loup » : un loup assis au milieu de la route.
这里|zhè lǐ|ici|lieux
那里|nà lǐ|là-bas|lieux
哪里|nǎ lǐ|où ?|questions|口
前面|qián miàn|devant|lieux
后面|hòu miàn|derrière|lieux
左边|zuǒ bian|à gauche|lieux
右边|yòu bian|à droite|lieux
旁边|páng biān|à côté|lieux
上|shàng|sur, en haut ; monter|lieux
下|xià|sous, en bas ; descendre|lieux
里|lǐ|dans, dedans|lieux
外|wài|dehors|lieux
吃|chī|manger|nourriture|口
喝|hē|boire|nourriture|口|« heu… » : « heu… j'ai soif », et tu bois.
水|shuǐ|eau|nourriture|氵|« un chouïa » : juste un chouïa d'eau dans le verre.
茶|chá|thé|nourriture||« chat » : un chat qui boit une tasse de thé.
米饭|mǐ fàn|riz cuit|nourriture|饣
菜|cài|plat ; légume|nourriture
水果|shuǐ guǒ|fruit|nourriture
苹果|píng guǒ|pomme|nourriture
鸡蛋|jī dàn|œuf|nourriture
羊肉|yáng ròu|viande de mouton|nourriture
牛奶|niú nǎi|lait|nourriture|女
面条|miàn tiáo|nouilles|nourriture
咖啡|kā fēi|café|nourriture|口
西瓜|xī guā|pastèque|nourriture
鱼|yú|poisson|nourriture
饭|fàn|repas ; riz cuit|nourriture|饣
杯子|bēi zi|verre, tasse|nourriture|木
好吃|hǎo chī|bon (à manger)|nourriture
饿|è|avoir faim|nourriture|饣
是|shì|être (c'est)|verbes|日
有|yǒu|avoir ; il y a|verbes
在|zài|être à, se trouver ; en train de|verbes
去|qù|aller|verbes
来|lái|venir|verbes
看|kàn|regarder ; lire|verbes
看见|kàn jiàn|voir|verbes
听|tīng|écouter|verbes|口
说|shuō|parler, dire|verbes|讠
说话|shuō huà|parler|verbes|讠
读|dú|lire (à voix haute)|verbes|讠
写|xiě|écrire|verbes
学习|xué xí|étudier, apprendre|verbes
工作|gōng zuò|travailler ; travail|verbes
做|zuò|faire|verbes|亻
买|mǎi|acheter|verbes||« maille » : tu achètes un pull en mailles (3e ton : la voix descend puis remonte).
卖|mài|vendre|verbes||« mai » : tu vends tout au marché de mai (4e ton : la voix tombe).
开|kāi|ouvrir ; conduire|verbes
坐|zuò|s'asseoir ; prendre (bus, avion)|verbes||« zoo » : tu t'assois sur un banc du zoo.
住|zhù|habiter|verbes|亻
睡觉|shuì jiào|dormir|verbes
起床|qǐ chuáng|se lever|verbes
叫|jiào|s'appeler ; appeler|verbes|口
认识|rèn shi|connaître (quelqu'un)|verbes|讠
知道|zhī dao|savoir|verbes
喜欢|xǐ huan|aimer bien|verbes
爱|ài|aimer|verbes||« aïe » : l'amour fait parfois « aïe ».
想|xiǎng|penser ; avoir envie de|verbes|心
要|yào|vouloir ; devoir|verbes
会|huì|savoir faire ; (futur probable)|verbes
能|néng|pouvoir (être capable)|verbes
可以|kě yǐ|pouvoir (avoir le droit)|verbes
打电话|dǎ diàn huà|téléphoner|verbes|扌
回|huí|revenir, rentrer|verbes||« oui » : « oui, je rentre ! »
到|dào|arriver|verbes
走|zǒu|marcher ; partir|verbes||« zou » : « allez, zou ! on part. »
跑步|pǎo bù|courir (faire un footing)|verbes|足
游泳|yóu yǒng|nager|verbes|氵
洗|xǐ|laver|verbes|氵
给|gěi|donner|verbes|纟
找|zhǎo|chercher|verbes|扌
等|děng|attendre|verbes||« dent » : tu attends chez le dentiste.
帮助|bāng zhù|aider|verbes
告诉|gào su|dire à, informer|verbes
问|wèn|demander|verbes||« vent » : tu poses ta question au vent.
回答|huí dá|répondre|verbes
让|ràng|laisser ; faire faire|verbes|讠
穿|chuān|porter (un vêtement)|verbes
送|sòng|offrir ; raccompagner|verbes||« son » : tu offres une boîte à musique qui fait un son.
玩|wán|jouer, s'amuser|verbes
唱歌|chàng gē|chanter|verbes|口
跳舞|tiào wǔ|danser|verbes|足
进|jìn|entrer|verbes
出|chū|sortir|verbes
休息|xiū xi|se reposer|verbes|亻
准备|zhǔn bèi|préparer|verbes
开始|kāi shǐ|commencer|verbes
完|wán|finir|verbes
懂|dǒng|comprendre|verbes|忄|« don » : tu as le don de tout comprendre.
觉得|jué de|trouver, penser (avis)|verbes
希望|xī wàng|espérer|verbes
介绍|jiè shào|présenter|verbes
生病|shēng bìng|tomber malade|verbes
考试|kǎo shì|examen ; passer un examen|verbes|讠
上班|shàng bān|aller au travail|verbes
旅游|lǚ yóu|voyager (en touriste)|verbes
运动|yùn dòng|sport ; faire du sport|verbes
踢足球|tī zú qiú|jouer au football|verbes|足
打篮球|dǎ lán qiú|jouer au basket|verbes|扌
下雨|xià yǔ|pleuvoir|verbes
笑|xiào|rire, sourire|verbes
用|yòng|utiliser|verbes
离|lí|être loin de (distance)|verbes
好|hǎo|bien, bon|adjectifs|女
大|dà|grand|adjectifs||« dada » : un grand dada (cheval de bois).
小|xiǎo|petit|adjectifs||« chiot » : un tout petit chiot.
多|duō|beaucoup|adjectifs||« dos » : beaucoup de sacs sur le dos.
少|shǎo|peu|adjectifs
冷|lěng|froid|adjectifs||« langue » : il fait si froid que ta langue gèle.
热|rè|chaud|adjectifs
高兴|gāo xìng|content|adjectifs
漂亮|piào liang|joli, beau|adjectifs|氵
忙|máng|occupé|adjectifs|忄|« mangue » : trop occupé pour manger ta mangue.
累|lèi|fatigué|adjectifs||« lait » : fatigué, tu bois un lait chaud.
快|kuài|rapide ; bientôt|adjectifs|忄|« quai » : tu cours vite sur le quai de la gare.
慢|màn|lent|adjectifs|忄
贵|guì|cher|adjectifs||« gui » : le gui coûte cher à Noël.
便宜|pián yi|bon marché|adjectifs|亻
长|cháng|long|adjectifs
新|xīn|nouveau|adjectifs
远|yuǎn|loin|adjectifs
近|jìn|proche|adjectifs
对|duì|juste, correct|adjectifs
错|cuò|faux, erreur|adjectifs|钅
好看|hǎo kàn|beau (à regarder)|adjectifs
白|bái|blanc|adjectifs
黑|hēi|noir|adjectifs
红|hóng|rouge|adjectifs|纟
高|gāo|grand (de taille), haut|adjectifs
难|nán|difficile|adjectifs||« nan ! » : « nan, c'est trop difficile ! »
容易|róng yì|facile|adjectifs
晴|qíng|ensoleillé|adjectifs|日
阴|yīn|nuageux, couvert|adjectifs
不|bù|ne… pas|mots outils
没|méi|ne pas (avoir), pas encore|mots outils|氵
吗|ma|(particule de question)|mots outils|口
呢|ne|et… ? (particule)|mots outils|口
吧|ba|(particule de suggestion)|mots outils|口
的|de|(particule : de, à moi…)|mots outils|白
了|le|(particule : c'est fait, changement)|mots outils
很|hěn|très|mots outils
也|yě|aussi|mots outils
都|dōu|tous, tout|mots outils
和|hé|et, avec|mots outils
这|zhè|ce, ceci|mots outils
那|nà|cela ; alors|mots outils
真|zhēn|vraiment|mots outils
太|tài|trop|mots outils
最|zuì|le plus|mots outils
非常|fēi cháng|extrêmement|mots outils
一起|yì qǐ|ensemble|mots outils
一点|yì diǎn|un peu|mots outils
一下|yí xià|un instant, un petit coup|mots outils
还|hái|encore ; aussi|mots outils
就|jiù|alors, justement|mots outils
再|zài|encore (une fois de plus)|mots outils
可能|kě néng|peut-être, possible|mots outils
因为|yīn wèi|parce que|mots outils
所以|suǒ yǐ|donc|mots outils
但是|dàn shì|mais|mots outils|亻
每|měi|chaque|mots outils
什么|shén me|quoi ?|questions|亻
谁|shéi|qui ?|questions|讠
几|jǐ|combien ? (petit nombre)|questions
多少|duō shao|combien ?|questions
怎么|zěn me|comment ?|questions|心
怎么样|zěn me yàng|comment c'est ?|questions|心
为什么|wèi shén me|pourquoi ?|questions
哪|nǎ|lequel ?|questions|口
书|shū|livre|objets||« chou » : un livre caché dans un chou.
桌子|zhuō zi|table|objets|木
椅子|yǐ zi|chaise|objets|木
电脑|diàn nǎo|ordinateur|objets
电视|diàn shì|télévision|objets
电影|diàn yǐng|film|objets
手机|shǒu jī|téléphone portable|objets|木
手表|shǒu biǎo|montre|objets
衣服|yī fu|vêtements|objets
东西|dōng xi|chose, affaires|objets
钱|qián|argent|objets|钅
票|piào|billet, ticket|objets
报纸|bào zhǐ|journal (papier)|objets|纟
字|zì|caractère (écrit)|objets
汉语|hàn yǔ|langue chinoise|objets|氵
中文|zhōng wén|chinois (langue écrite)|objets
门|mén|porte|objets
药|yào|médicament|objets
课|kè|cours, leçon|objets|讠
问题|wèn tí|question, problème|objets
事情|shì qing|affaire, chose à faire|objets|忄
颜色|yán sè|couleur|objets
意思|yì si|sens (d'un mot)|objets|心
天气|tiān qì|temps (météo)|nature
太阳|tài yáng|soleil|nature
雨|yǔ|pluie|nature
雪|xuě|neige|nature
花|huā|fleur|nature||« waouh » : « waouh, une fleur ! »
猫|māo|chat|nature||« miaou » : le chat fait « mao ».
狗|gǒu|chien|nature||« goût » : un chien qui goûte à tout.
马|mǎ|cheval|nature||« mare » : un cheval qui boit dans une mare.
眼睛|yǎn jing|yeux|corps
身体|shēn tǐ|corps ; santé|corps|亻
手|shǒu|main|corps
车|chē|voiture, véhicule|transports
出租车|chū zū chē|taxi|transports
飞机|fēi jī|avion|transports|木|« fée » : une fée qui vole aussi vite qu'un avion.
公共汽车|gōng gòng qì chē|bus|transports|氵
自行车|zì xíng chē|vélo|transports
火车|huǒ chē|train|transports
`;

export const MOTS_ZH: MotZh[] = LIGNES.trim().split("\n").map((l) => {
  const [hz, py, fr, theme, radical, cle] = l.split("|");
  return { hz, py, fr, theme, ...(radical ? { radical } : {}), ...(cle ? { cle } : {}) };
});

/** Radicaux courants : la partie du caractère qui donne souvent une idée du sens (pas toujours). */
export const RADICAUX: { r: string; nom: string; sens: string }[] = [
  { r: "口", nom: "kǒu", sens: "la bouche : manger, boire, parler, particules de la langue parlée" },
  { r: "女", nom: "nǚ", sens: "la femme : membres féminins de la famille" },
  { r: "氵", nom: "shuǐ (trois gouttes)", sens: "l'eau : laver, nager" },
  { r: "亻", nom: "rén (personne debout)", sens: "la personne : pronoms, actions humaines" },
  { r: "木", nom: "mù", sens: "l'arbre, le bois : table, chaise, objets en bois" },
  { r: "日", nom: "rì", sens: "le soleil, le jour : le temps qui passe" },
  { r: "心", nom: "xīn", sens: "le cœur : pensées, sentiments (forme du bas)" },
  { r: "忄", nom: "xīn (cœur debout)", sens: "le cœur : sentiments, état d'esprit (forme de gauche)" },
  { r: "讠", nom: "yán (parole)", sens: "la parole : dire, lire, demander" },
  { r: "扌", nom: "shǒu (main)", sens: "la main : frapper, chercher, gestes" },
  { r: "饣", nom: "shí (nourriture)", sens: "la nourriture : repas, faim, restaurant" },
  { r: "足", nom: "zú (pied)", sens: "le pied : marcher, courir, danser, route" },
  { r: "纟", nom: "sī (soie)", sens: "le fil, la soie : couleurs, papier, objets tissés" },
  { r: "钅", nom: "jīn (métal)", sens: "le métal, l'or : argent, objets en métal" },
  { r: "白", nom: "bái", sens: "blanc, clair" },
];

// Phrases : mots séparés par « / », pinyin de chaque mot séparés par « / », traduction, ponctuation finale.
const PHRASES = `
我/是/学生|wǒ/shì/xué sheng|Je suis étudiant.|。
你/好/吗|nǐ/hǎo/ma|Tu vas bien ?|？
我/很/好|wǒ/hěn/hǎo|Je vais très bien.|。
你/叫/什么/名字|nǐ/jiào/shén me/míng zi|Comment t'appelles-tu ?|？
我/是/法国人|wǒ/shì/fǎ guó rén|Je suis français.|。
他/是/我/的/朋友|tā/shì/wǒ/de/péng you|C'est mon ami.|。
我/喜欢/喝/茶|wǒ/xǐ huan/hē/chá|J'aime boire du thé.|。
我/不/喝/咖啡|wǒ/bù/hē/kā fēi|Je ne bois pas de café.|。
今天/很/冷|jīn tiān/hěn/lěng|Il fait froid aujourd'hui.|。
明天/我/去/北京|míng tiān/wǒ/qù/běi jīng|Demain, je vais à Pékin.|。
你/去/哪里|nǐ/qù/nǎ lǐ|Où vas-tu ?|？
我/在/家|wǒ/zài/jiā|Je suis à la maison.|。
我/有/一个/哥哥|wǒ/yǒu/yí gè/gē ge|J'ai un grand frère.|。
妈妈/在/做饭|mā ma/zài/zuò fàn|Maman est en train de cuisiner.|。
这/是/什么|zhè/shì/shén me|Qu'est-ce que c'est ?|？
这/是/我/的/书|zhè/shì/wǒ/de/shū|C'est mon livre.|。
那/是/谁|nà/shì/shéi|Qui est-ce ?|？
我/想/吃/米饭|wǒ/xiǎng/chī/mǐ fàn|J'ai envie de manger du riz.|。
多少/钱|duō shao/qián|Combien ça coûte ?|？
太/贵/了|tài/guì/le|C'est trop cher !|！
我/买/三个/苹果|wǒ/mǎi/sān gè/píng guǒ|J'achète trois pommes.|。
现在/几/点|xiàn zài/jǐ/diǎn|Quelle heure est-il ?|？
现在/八/点|xiàn zài/bā/diǎn|Il est huit heures.|。
我/七/点/起床|wǒ/qī/diǎn/qǐ chuáng|Je me lève à sept heures.|。
我/每天/学习/汉语|wǒ/měi tiān/xué xí/hàn yǔ|J'étudie le chinois tous les jours.|。
汉语/不/难|hàn yǔ/bù/nán|Le chinois n'est pas difficile.|。
我/听/不/懂|wǒ/tīng/bu/dǒng|Je ne comprends pas (ce que j'entends).|。
请/再/说/一遍|qǐng/zài/shuō/yí biàn|Répète, s'il te plaît.|。
你/会/说/汉语/吗|nǐ/huì/shuō/hàn yǔ/ma|Tu sais parler chinois ?|？
我/会/说/一点/汉语|wǒ/huì/shuō/yì diǎn/hàn yǔ|Je parle un peu chinois.|。
他/在/医院/工作|tā/zài/yī yuàn/gōng zuò|Il travaille à l'hôpital.|。
我/坐/出租车/去|wǒ/zuò/chū zū chē/qù|J'y vais en taxi.|。
我们/一起/去/吧|wǒ men/yì qǐ/qù/ba|Allons-y ensemble.|。
你/累/吗|nǐ/lèi/ma|Tu es fatigué ?|？
我/很/忙|wǒ/hěn/máng|Je suis très occupé.|。
天气/很/好|tiān qì/hěn/hǎo|Il fait beau.|。
下雨/了|xià yǔ/le|Il s'est mis à pleuvoir.|。
我/的/手机/在/哪里|wǒ/de/shǒu jī/zài/nǎ lǐ|Où est mon téléphone ?|？
桌子/上/有/一本/书|zhuō zi/shàng/yǒu/yì běn/shū|Il y a un livre sur la table.|。
猫/在/椅子/下面|māo/zài/yǐ zi/xià miàn|Le chat est sous la chaise.|。
我/爱/我/的/家|wǒ/ài/wǒ/de/jiā|J'aime ma famille.|。
我/妈妈/是/老师|wǒ/mā ma/shì/lǎo shī|Ma mère est professeure.|。
我/爸爸/是/医生|wǒ/bà ba/shì/yī shēng|Mon père est médecin.|。
你/家/有/几/口/人|nǐ/jiā/yǒu/jǐ/kǒu/rén|Combien êtes-vous dans ta famille ?|？
我/家/有/四/口/人|wǒ/jiā/yǒu/sì/kǒu/rén|Nous sommes quatre dans ma famille.|。
她/是/我/姐姐|tā/shì/wǒ/jiě jie|C'est ma grande sœur.|。
我/弟弟/十/岁|wǒ/dì di/shí/suì|Mon petit frère a dix ans.|。
你/多/大|nǐ/duō/dà|Quel âge as-tu ?|？
我/今年/二十/岁|wǒ/jīn nián/èr shí/suì|J'ai vingt ans cette année.|。
我/喜欢/跑步|wǒ/xǐ huan/pǎo bù|J'aime courir.|。
他/喜欢/踢/足球|tā/xǐ huan/tī/zú qiú|Il aime jouer au football.|。
我们/去/游泳/吧|wǒ men/qù/yóu yǒng/ba|Allons nager !|！
我/在/看/书|wǒ/zài/kàn/shū|Je suis en train de lire.|。
他/在/看/电视|tā/zài/kàn/diàn shì|Il regarde la télévision.|。
我/想/睡觉|wǒ/xiǎng/shuì jiào|J'ai envie de dormir.|。
晚上/好|wǎn shang/hǎo|Bonsoir.|！
早上/好|zǎo shang/hǎo|Bonjour (le matin).|！
谢谢/你|xiè xie/nǐ|Merci à toi.|！
不/客气|bú/kè qi|De rien.|。
对不起/我/来/晚/了|duì bu qǐ/wǒ/lái/wǎn/le|Pardon, je suis en retard.|。
没/关系|méi/guān xi|Ce n'est pas grave.|。
我/不/知道|wǒ/bù/zhī dao|Je ne sais pas.|。
你/说/得/对|nǐ/shuō/de/duì|Tu as raison.|。
这个/很/好吃|zhè ge/hěn/hǎo chī|C'est très bon.|。
我/饿/了|wǒ/è/le|J'ai faim.|。
我/要/一杯/水|wǒ/yào/yì bēi/shuǐ|Je voudrais un verre d'eau.|。
商店/几/点/开门|shāng diàn/jǐ/diǎn/kāi mén|À quelle heure ouvre le magasin ?|？
学校/离/这里/很/远|xué xiào/lí/zhè lǐ/hěn/yuǎn|L'école est loin d'ici.|。
火车站/在/前面|huǒ chē zhàn/zài/qián miàn|La gare est devant.|。
我/坐/飞机/去/中国|wǒ/zuò/fēi jī/qù/zhōng guó|Je vais en Chine en avion.|。
我/昨天/很/累|wǒ/zuó tiān/hěn/lèi|Hier, j'étais très fatigué.|。
你/什么/时候/来|nǐ/shén me/shí hou/lái|Quand est-ce que tu viens ?|？
我/下午/来|wǒ/xià wǔ/lái|Je viens l'après-midi.|。
请/进|qǐng/jìn|Entre, je t'en prie.|。
请/坐|qǐng/zuò|Assieds-toi, je t'en prie.|。
你/的/衣服/很/漂亮|nǐ/de/yī fu/hěn/piào liang|Tes vêtements sont très jolis.|。
我/生病/了|wǒ/shēng bìng/le|Je suis malade.|。
我/要/去/医院|wǒ/yào/qù/yī yuàn|Je dois aller à l'hôpital.|。
他/是/我/的/同学|tā/shì/wǒ/de/tóng xué|C'est mon camarade de classe.|。
这/本/书/很/有意思|zhè/běn/shū/hěn/yǒu yì si|Ce livre est très intéressant.|。
欢迎/你/来/中国|huān yíng/nǐ/lái/zhōng guó|Bienvenue en Chine !|！
我/的/朋友/住/在/北京|wǒ/de/péng you/zhù/zài/běi jīng|Mon ami habite à Pékin.|。
`;

export const PHRASES_ZH: PhraseZh[] = PHRASES.trim().split("\n").map((l) => {
  const [m, p, fr, fin] = l.split("|");
  return { mots: m.split("/"), py: p.split("/"), fr, fin };
});

/**
 * Caractères seuls pour l'exercice des tons, groupés par syllabe (妈 mā, 麻 má, 马 mǎ, 骂 mà…).
 * On évite 一 et 不 (leur ton change selon le mot suivant) et les caractères à plusieurs lectures courantes.
 */
export const SYLLABES_TONS: { hz: string; py: string }[] = `
妈 mā|麻 má|马 mǎ|骂 mà|八 bā|拔 bá|把 bǎ|爸 bà|衣 yī|姨 yí|椅 yǐ|意 yì|汤 tāng|糖 táng|躺 tǎng|烫 tàng
通 tōng|同 tóng|桶 tǒng|痛 tòng|优 yōu|油 yóu|有 yǒu|又 yòu|方 fāng|房 fáng|访 fǎng|放 fàng
灰 huī|回 huí|毁 huǐ|会 huì|鸡 jī|急 jí|挤 jǐ|记 jì|乌 wū|无 wú|五 wǔ|雾 wù|千 qiān|钱 qián|浅 qiǎn|欠 qiàn
吃 chī|迟 chí|尺 chǐ|翅 chì|飞 fēi|肥 féi|费 fèi|书 shū|鼠 shǔ|树 shù|喝 hē|河 hé|贺 hè|猫 māo|毛 máo|帽 mào
烟 yān|盐 yán|眼 yǎn|天 tiān|甜 tián|买 mǎi|卖 mài|山 shān|闪 shǎn|他 tā|塔 tǎ
`.trim().split(/[|\n]/).map((x) => {
  const [hz, py] = x.trim().split(" ");
  return { hz, py };
});
