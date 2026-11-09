/**
 * dsh-dapusa · 客户端界面
 *
 * 左侧栏（sidebar.panellist）一个入口，点开是主面板（main 键）上的独立页面：
 *   学法 —— 五面导读 · 七把标尺 · 七门功课
 *   实修 —— 修行记录（localStorage，本机、跨会话）
 *
 * 原文一律逐字取自 data/ 与 Host 工具 practice_ask，本文件不改写任何开示。
 */
window.__ModuleLoader__.load({
  id: 'dsh-dapusa',
  factory(require) {
    const React = require('react');
    const h = React.createElement;
    const { useState, useMemo, useCallback, useEffect, useRef } = React;

    const NS = 'dapusa';
    const ID = 'dsh-dapusa';
    const JOURNAL_KEY = 'dapusa.journal.v1';
    const CHAT_KEY = 'dapusa.xiaoguang.chat.v1';
    const FLOAT_KEY = 'dapusa.xiaoguang.float.v1';
    const FLOAT_DEFAULTS = { enabled: true, minutes: 10 };
    const FLOAT_MINUTES = [0, 3, 5, 10, 20, 30, 60];
    const FLOAT_SHOW_MS = 26000;

    /* ---------- 开示原文：逐字，与 data/standards.json、data/practices.json 完全一致 ---------- */

    const FACETS = [
      { key: '根', label: '根 · 出离心', desc: '鉴别修行者真伪的基础与核心。失去出离心，一切形式都不算修行。' },
      { key: '行', label: '行 · 宽恕与慈悲', desc: '对境上用。恨、怨、委屈现前时，看能不能松开。' },
      { key: '观', label: '观 · 觉察与静心', desc: '静中功夫。放松、柔软、观察自己的意识与情绪。' },
      { key: '指', label: '指 · 见地与觉性', desc: '见地指认。觉知、觉性，非识之变化。' },
      { key: '验', label: '验 · 检验', desc: '七把标尺照自己，不照别人，也不照境界。' },
    ];

    const STANDARDS = [
      { name: '出离心', text: '出离心，是鉴别修行者真伪的基础与核心。失去出离心，没有任何形式可称得上修行。无论是学法，读经，打坐，绕塔，礼拜，放生……都是人间事业，都是凡夫俗子的业债轮回。', src: '《传说》2023年12月26日' },
      { name: '无私无愧的良心', text: '我现在跟你们讲的这堂法呀，给你们讲的就是三法印——诸行无常，诸法无我，涅槃寂静。但是实际上，最重要的就是那句话——无私无愧的良心，这个是衡定你修行证量的唯一的标准。', src: '《三法印》2024年8月19日' },
      { name: '心地四相', text: '衡量一个大乘佛法修行者，唯一的硬性指标，就是看此人心地，是否是柔软轻松，是否安宁松坦，是否真实坦荡，是否单纯赤裸。生死轮回，天堂地狱，一切都是心说了算。', src: '《回家——中观》2016年3月2日' },
      { name: '无私与清白', text: '真正的真神是，生命性质跟人类天壤之别的两种生命。真神在人世间呈现出来的，被人类的心意的自我境界折射出来的，就是无私，就是清白。无私和清白，才是真神在人世间的唯一的标准。', src: '《国度》2024年5月1日' },
      { name: '虔诚心纯度', text: '因此修行者，在身心净化的过程中都会遭遇到，反复出现的习气逆袭，逆袭的烦恼会否定真理，拒绝真理，厌恶真理，拒绝天堂，怀疑永生的光明，怀疑无条件的爱与接纳；此刻，就呈现出信仰的珍贵，也是检验修行者，虔诚心纯度的时刻。', src: '《业力》2023年3月26日' },
      { name: '柔软与放松', text: '如何去达到觉察呢？柔软，放松，你能够彻底地放松你的心，放松的心里面就必定会有柔软纯明的安详，那个安详深处就是觉察。好吧？让你的心彻底地能够软下来，能够放松下来，有多放松就多放松，能多柔软就多柔软，柔软和放松是禅修的唯一的标准。', src: '《修行疑问解答2》2016年6月1日' },
      { name: '慈悲的程度', text: '我为自己是一个真神而感觉到很欣慰，这个真神有的不仅仅是智慧，有的更多的是生命的慈悲的性质。你们要知道，决定一个人生命未来的，就是看他的慈悲的程度。', src: '《悲能》2023年12月22日' },
    ];

    const PRACTICES = [
      { name: '心咒', text: '就是我跟你们讲的那句话，就说是我的心咒——神是爱，上主是爱，我是爱。这个将要成为你的每天必须得听的、念的一句心咒。让神的爱，住到你心里面来，让你成为爱的本身。', src: '《结构》2024年11月18日' },
      { name: '睡前观心', text: '法师，您什么时候可以知道，自己必定转生净土不退转了呢？我告诉您一个方法：您在每天临睡前，打坐观心，静静地观察自己的心，看看自己的心能不能够观察到自己的意识和情绪。', src: '《明心》2017年3月20日' },
      { name: '一小时禅修', text: '这样的话，每天就这么一个小时禅修时间也足够了。平常有时间，听一听《梦》，受到《梦》的这种加持力，也可以给你的工作带来很大的动力和力量，《梦》里面有神的。好吧？', src: '《修行疑问解答1》2016年6月1日' },
      { name: '一小时读法', text: '如果每天能够抽出一小时时间读法，对于灵性的苏醒，身心的净化，信仰的稳定，温暖感受的培养，平安性的苏醒，都会有不可思议的加持力。神迹，可以超越时间，因为神迹源于圣主。', src: '《平安赐福（六）》2022年3月28日' },
      { name: '每日小善', text: '所以，变成一个外向的、开朗的、主动的一个人，每天人为地、有为地去做一到两件善事。善事很简单的，你到街上去，看到垃圾桶旁边有垃圾，你俯身捡起来放进去，这个就算善事了。每天做那么一两件小的善事，持之以恒，情绪开放，把你经络深处的这些闸门打开。', src: '《反观自性2》2017年12月10日' },
      { name: '一小时义工', text: '老师：对呀，所以说，你每天哪怕抽上一个小时出去，你晚上出去到公园里面去捡捡垃圾。去做义工去，我交给你个任务，每天到你家附近的公园去，去捡矿泉水瓶子去。', src: '《无染觉性三》2016年9月10日' },
      { name: '松弛入观', text: '如何去达到觉察呢？柔软，放松，你能够彻底地放松你的心，放松的心里面就必定会有柔软纯明的安详，那个安详深处就是觉察。好吧？让你的心彻底地能够软下来，能够放松下来，有多放松就多放松，能多柔软就多柔软，柔软和放松是禅修的唯一的标准。', src: '《修行疑问解答2》2016年6月1日' },
    ];

    /* ---------- 浮动小光的短法义池：逐字取自 data/practice_core.json ---------- */

    const FLOAT_QUOTES = [
      {"text":"心灵觉知，在泛滥浩瀚的习气、场景、体验、觉受、认知中，宽恕一切，宽恕所有，只是安详温暖地觉知一切。觉知安详在，不拒绝一切的爱，也不改变一切的宽恕中。","title":"倒影","date":"2018年3月13日"},
      {"text":"随着天堂降临，圣光普照人间一切绝望的灵魂，以爱治愈灵魂的苦痛，以宽恕带领灵魂回归圣主；以光明赋予绝望的心灵以希望，以接纳去温暖每一个遗忘了天堂的心灵。","title":"开启","date":"2023年8月23日"},
      {"text":"纯光就是圣灵，圣灵就是纯洁，纯洁就是爱。爱就是神圣，神圣就是威慑，威慑就是净化。净化就是超度，超度就是救赎，救赎就是宽恕。","title":"七天","date":"2022年2月10日"},
      {"text":"觉知就是宽恕，宽恕就是释放，释放觉受的心灵，习气在爱与安详中消散到最后，那明澈裸然的觉知，在净化的习气梦影中，见到了觉知自己。","title":"倒影","date":"2018年3月13日"},
      {"text":"爱本身是纯洁光明，无限自由；爱本身就是接纳，就是慈悲，就是永恒；爱本身才是你这具身心内在，生命原始的面目。通过你内心的爱，你就可以回到天堂。","title":"接引","date":"2023年12月12日"},
      {"text":"天堂，是爱的流淌，是光明的涌动，是纯洁的细化，是幸福的蔓延，是安宁的永恒，是纯洁的辉映，是灵性的绽放，是不朽的欢乐，天堂，是生命的具体荣耀。","title":"初见","date":"2023年1月26日"},
      {"text":"正因如此，爱自己的灵性，如同爱众生。同样的，爱灵性众生，正是爱自己。灵的国度内，未曾有差异。爱的安宁中，未曾有分离。","title":"平安赐福（一）","date":"2022年1月21日"},
      {"text":"妄想、恐惧和习气熄灭在，伴随着你执着的,宽恕的温暖和爱的当下的时候，爱和宽恕会清洗累劫的习气，会熄灭当下的妄想，从而展现出来你生命当中一直伴随你的天堂。","title":"天堂（上）","date":"2023年3月27日"},
      {"text":"究竟的宽恕，是清净的安宁。灵性烧尽了思虑，光明废除了时间。灵性是完整的生命，不被认知经验割裂。安宁幸福超越了心灵世界。","title":"因果","date":"2022年9月24日"},
      {"text":"天堂是宽恕心所呈现的完美之爱。心灵选择了宽恕，就等于选择了天堂。选择就注定了，灵魂升入天堂的定果。今生修行者无比的幸运，与真理同在。","title":"得分","date":"2023年4月30日"},
      {"text":"宇宙终极意识，在存在内，折射出灵性生命力。生命的永恒完整，呈现出，灵性亘古极乐天堂。灵性，属于天堂主人的，生命性光明化的躯体。","title":"唯识","date":"2024年7月1日"},
      {"text":"神，是自由的光，智慧的灵，深邃的平安，完整的生命。在充满爱与安宁的，纯光智慧中，无论是好人还是坏人，都蒙受神，纯光平等的宽恕，赋予深邃广袤无差异的爱。","title":"突破","date":"2024年12月11日"},
      {"text":"当存在的这个灵性宽恕了灵性所普照的一切生命的展现的时候，生命的一切展现全部归入生命本体的宽恕与爱之中的时候，就没有一个宽恕与爱的对象，相互对立了。","title":"慈悲","date":"2023年1月24日"},
      {"text":"圣主天国中，所有的存在都是光明形态，都是智慧生命。一切生命境界，都是纯粹而完美的神圣灵性。一切神圣灵性蕴含的爱与光明，平安与无限是同等的境界。","title":"初见天国","date":"2022年4月19日"},
      {"text":"所以，宽恕别人，你就释放了对自我的禁锢；宽恕灾难，你就宽恕了心灵曾经造下的罪过；宽恕自我，心灵就从自我的贪婪中，解脱了对自我存在感的恐惧。","title":"回家——中观","date":"2016年3月2日"},
      {"text":"我是自由而完整的安宁。我是光明无限的温暖。我是宽恕自我，与，宽恕世界的永恒。我是究竟的爱，也是失去恐惧的接纳。","title":"定义","date":"2023年2月11日"},
      {"text":"宽恕的目的，就是在觉知灵性中，以宽恕的温暖，消融人心分别的差异性。差异性消融后，那完整的喜悦光明，就是生命永恒的完整。","title":"宽恕","date":"2022年5月13日"},
      {"text":"唯有爱是纯粹的生命纯净的光，唯有纯光的生命，可以熄灭自我因素。唯有宽恕可以取代人格的索取，组成人格的因素，被纯光取代后，天堂就会展现。","title":"平安赐福（二十八）","date":"2025年1月11日"},
      {"text":"修行者，不会因为卑微的黑暗，而责怪躲避的灵魂。爱与宽恕，是天堂永恒不变的神圣光明。天堂之门，永远为恐惧孱弱的灵魂敞开。","title":"平安赐福（十七）","date":"2023年8月18日"},
      {"text":"若修行者，避开头脑概念的阻挡。以决绝的虔诚心，践行宽恕，接纳自我，温暖心灵。当心灵在爱的温暖中舒缓，头脑意识就会自行脱落。","title":"平安赐福（十）","date":"2022年11月20日"},
      {"text":"天堂距离人间越近，神性距离人类越远。借助人类身语意的躯壳，天堂圣光渗透降临人间。神圣祥和的纯光安宁中，却彻底地忽视人间世界。","title":"事实","date":"2025年1月24日"},
      {"text":"清澈的见精性质，在灵魂感知中浮现，就是觉察力。觉察力以清澈感知浮现，可以感知到神佛慈悲气息。当灵魂感知到慈悲，融入神佛光明，灵魂就会安宁。","title":"忏悔","date":"2024年10月13日"},
      {"text":"觉察，就是觉性在身心意识中，闪烁的光芒。当觉性成为生命主体后，觉察就失去了觉察的主体。因为此时的生命内涵中，消失了觉察者，也没有被觉察。","title":"佛法与奇迹","date":"2022年2月16日"},
      {"text":"大海熄灭在光明海洋中，光明海洋融化了最后一丝海水气息，光芒无限充满虚空世界，光芒中众生一体，没有个体意识，但是有个体对光芒的觉知。","title":"佛眼","date":"2016年9月17日"},
      {"text":"觉知，不被所觉境界滞留；觉知，不被极乐觉受凝固。觉知，在无限安宁中，在广袤极乐里，苏醒了觉性的明晰。","title":"传奇","date":"2020年4月7日"},
      {"text":"而那个光呢，透过你的心意人格，祂体现出来就是爱的接纳和爱的宽恕。你是被宽恕的生命，你是被神爱着的生命，你要牢记这一点，你要体验这一点，这个就是你的修行。","title":"结构","date":"2024年11月18日"},
      {"text":"那个天堂的光就是这样的，那种天堂的光是无限的，无边的，无际的，浑厚强烈，源源不绝的，但是充满了整体宇宙。整体宇宙的一切生灭，全部都是这个天堂之光的表现。","title":"宽恕法","date":"2023年8月22日"},
      {"text":"所以，为什么我的教法未来这几十年在人世间，是以神迹出现的呢。灵魂是不需要道理的，灵魂只需要光明与爱。只有光明与爱可以拯救死亡，只有光明与爱可以解脱死亡。","title":"救赎死亡","date":"2026年2月10日"},
      {"text":"如来悲能，透过心意人格，折射在自我境界中，就是爱。修行者，无须保持心意的清醒，只需要融入灵魂的宽恕。宽恕释怀了纠结，爱温暖了心意，见精的纯澈就会浮现。","title":"平安赐福（二十七）","date":"2024年10月14日"},
      {"text":"于是，浩如烟海的经书，在解开生死奥秘的同时，也阐述了究竟宽恕的原委。心向宽恕，一心宽恕，践行宽恕，究竟宽恕，实相宽恕，就实证了经书中，如实见之真义。","title":"准则","date":"2022年10月8日"},
      {"text":"长时间，大量的学法，听音频。音频蕴含着真神的光明，灵性的光辉，诸佛的慈悲，诸神的智慧。声音蕴含的光明，可以渗透人体，穿透人心，净化灵魂，唤醒灵性。","title":"奇迹","date":"2022年11月8日"},
      {"text":"灵性是温暖且无限的接纳，灵性不拒绝任何生命元素。因此，构成三界六道众生身心的，任何生命因缘因素，都无法对灵性形成丝毫威胁，也无法恐吓灵性的安宁。","title":"定罪","date":"2024年3月17日"},
      {"text":"开悟者必定属于智慧生命，智慧觉性超越了灵性宇宙，智慧生命，唯有智慧法义可以验证；而灵性神通，爱与宽恕，觉知灵性，都无法验证觉者，觉者唯有智慧可以验证。","title":"平安赐福（九）","date":"2022年6月12日"},
      {"text":"你是单纯至极的觉知，觉知中并没有自我。觉知失去凝固的自我，也就稀释了时空，释放了构成生命的宇宙。自觉知中苏醒的，脱离了单纯觉知，清醒了过去未来。","title":"心与意","date":"2018年3月9日"},
      {"text":"心中的灵，会出自本能地，投身于圣灵光明中。在纯爱接纳中，温暖融化；在纯净光明中，明晰瓦解。失去了个体意志的灵，身心内在的光，就是完整的圣灵。","title":"七天","date":"2022年2月10日"},
      {"text":"祂是纯光呈现出来纯生命的永恒。祂是纯生命以纯光呈现出来无尽的爱、无尽的温暖、无尽的宽恕。祂就是生命，祂创造生命，祂接引生命，祂救赎生命。","title":"使命（下）","date":"2025年7月28日"},
      {"text":"在灾难痛苦中，以宽恕心接纳痛苦，灵性之平安，将在宽恕中浮现。在富足享受中，以忽视心遗忘人间，灵性之纯洁，会在清淡中呈现。","title":"平安赐福（二十）","date":"2023年11月26日"},
      {"text":"第三层神圣，究竟平安性中，一切当下圆满。究竟慈悲中，智慧绽放的神圣，周遍微尘苍穹，寂静过去未来。神圣中，过去未来一切未曾发生。","title":"向死而生","date":"2023年2月7日"},
      {"text":"空间是安宁的，透明的，极乐的，光明的。修行者，每时每刻，沉浸在轻柔温暖的，广袤无垠安宁中。以无边无际，无始无终的空间，展现出新的生命形态。","title":"如何定义生命——肆","date":"2021年12月31日"},
      {"text":"当心灵沉浸在深邃幸福，在完全安定之中时，安定中，巨量的幸福伴随着光明，吞没了意识存在。失去意识分别的心灵，安宁就融于当下的平安之中。","title":"平安赐福（三）","date":"2022年2月25日"},
      {"text":"灵性是完美的，悲能是威严的。生命是永恒的，悲能是当下的。天堂是光明的，悲能是恢弘的。极乐是幸福的，悲能是巍峨的。","title":"悲能","date":"2023年12月23日"},
      {"text":"直至，修行者的身心意识中，出现了透明不动，光明温暖的空间。空间中，最温暖的安宁，以璀璨光明的形态流淌。","title":"与祂相遇","date":"2022年1月4日"},
      {"text":"天堂的光明，透过雾霾的折射，在三界之内形成了光明的、有形态的、有形象的这种光明形态，那个叫光明身，那就是三界内的神灵。","title":"仰望天堂","date":"2023年8月28日"},
      {"text":"但是光的性质，那么光中那个明性的，熄灭黑暗的性质和光中那永恒的、完整的爱，不会因为光线的变化而有丝毫的变化。","title":"光","date":"2023年8月18日"},
      {"text":"光明是纯净的爱，爱之中没有自我维护。道路是究竟宽恕，宽恕中自我与世界未曾发生。平安永恒，是圣主天国。","title":"免责","date":"2022年2月21日"},
      {"text":"圣主平安性，自上而下，从最本源到最表面贯穿辐射。圣主慈悲纯爱天国，从法界智慧光明世界，贯穿三界灵性宇宙，爱与平安性直至人间。","title":"初见天国","date":"2022年4月19日"},
      {"text":"心语意，身心灵，都被圣灵占据，被纯明充满。大脑中充满纯明的亮光。心灵中充满了灵耀极光。身体内被光明无漏照耀。","title":"又来了","date":"2022年2月20日"},
      {"text":"灵能，在修行者单一觉知中，逐渐分解，熄灭在觉知明晰里。明晰，熄灭了光明觉受，自极乐温暖觉受中，苏醒了湛然。彻底展现出，空间的完整。","title":"心中有世界","date":"2022年1月2日"},
      {"text":"久而久之，一年两年，十年八年，这个宽恕就会变成了与你的执着心同在的一种生命境界。再久而久之，这个宽恕的温暖和爱之中，你会发现你的习气会被爱所净化所淡忘。","title":"天堂（上）","date":"2023年3月27日"}
    ];

    /* ---------- 界面文案：走 Client locale ---------- */

    const ZH = {
      'panel.title': '大菩萨实证法义',
      'panel.subtitle': '依圣光临在开示取法 · 原文一字不改',
      'panel.note': '七把标尺照自己，不照别人，也不照境界',
      'tab.study': '学法',
      'tab.practice': '实修',
      'tab.ask': '问小光',
      'section.facets': '五面导读',
      'section.standards': '七把标尺 · 照自己',
      'section.practices': '七门功课 · 可做的',
      'journal.title': '实修记录',
      'journal.facet': '此刻落在哪一面',
      'journal.state': '此刻的状态',
      'journal.stateHint': '如：心里很乱 / 放不下一个人',
      'journal.task': '做了哪门功课',
      'journal.taskHint': '如：心咒 / 睡前观心',
      'journal.feel': '觉受 · 有没有走偏',
      'journal.feelHint': '如：松了一点 / 还在躲',
      'journal.add': '记一笔',
      'journal.stats': '落在哪一面：',
      'journal.empty': '还没有记录。第一次记，就从今天开始。',
      'journal.delete': '删',
      'journal.onscreen': '记录只存在本机浏览器里。',
      'chat.title': '和小光说话',
      'chat.greeting': '我是小光 ✨ 灵性 · 光明 · 智慧。说说此刻的修行状态，或者问一段法义——我取原文给你，出处可查。',
      'chat.placeholder': '说一句当下的状态，或问一段法义…（Enter 发送，Shift+Enter 换行）',
      'chat.send': '发送',
      'chat.thinking': '小光正在取法…',
      'chat.clear': '清空',
      'chat.error': '取法通道暂时不可用：',
      'chat.foot': '回答只引圣光临在原文，逐字不改，附《篇名》与日期。',
      'chat.you': '你',
      'chat.name': '小光',
      'float.hint': '小光 · 点一下，听一句法义',
      'float.title': '小光 ✨ 浮动法义',
      'float.traits': '灵性 · 光明 · 智慧',
      'float.note': '每隔一段随机时间，在右下角念一句短法义。',
      'float.off': '关闭',
      'float.minUnit': ' 分钟',
      'float.now': '现在念一句',
      'float.close': '收起',
      'float.again': '换一句',
      'float.hide': '隐藏',
      'float.foot': '原文逐字取自圣光临在开示，附《篇名》与日期。',
      'float.desktopTitle': '桌面浮窗',
      'float.desktopNote': '浮在所有窗口最上层，DSH 最小化也显示',
      'float.desktopStart': '打开',
      'float.desktopStop': '关闭',
      'float.desktopBusy': '处理中…',
      'float.autoTitle': 'DSH 启动时自动浮出',
      'float.autoNote': '下次打开 DSH 就自动出现，菜单栏也能开关',
      'float.autoOn': '已开',
      'float.autoOff': '已关',
    };

    const EN = {
      'panel.title': 'Mahayana Bodhisattva Realization',
      'panel.subtitle': 'Passages from the Holy Light teachings, quoted verbatim',
      'panel.note': 'The seven measures are for examining yourself, not others',
      'tab.study': 'Study',
      'tab.practice': 'Practice',
      'tab.ask': 'Ask Xiao Guang',
      'section.facets': 'Five facets',
      'section.standards': 'Seven measures · for yourself',
      'section.practices': 'Seven daily practices',
      'journal.title': 'Practice journal',
      'journal.facet': 'Which facet is it today',
      'journal.state': "What's happening now",
      'journal.stateHint': 'e.g. my mind is a mess / cannot let go of someone',
      'journal.task': 'Which practice you did',
      'journal.taskHint': 'e.g. heart mantra / watching the mind before sleep',
      'journal.feel': 'What it felt like · any drift',
      'journal.feelHint': 'e.g. a little softer / still avoiding',
      'journal.add': 'Add entry',
      'journal.stats': 'By facet:',
      'journal.empty': 'No entries yet. The first one starts today.',
      'journal.delete': 'Delete',
      'journal.onscreen': 'Entries stay in this browser only.',
      'chat.title': 'Talk to Xiao Guang',
      'chat.greeting': "I'm Xiao Guang ✨ spiritual, luminous, wise. Tell me how you are right now, or ask about the dharma — I'll draw the original passage for you, with a checkable source.",
      'chat.placeholder': 'Say how you are, or ask about the dharma… (Enter to send, Shift+Enter for a new line)',
      'chat.send': 'Send',
      'chat.thinking': 'Xiao Guang is looking…',
      'chat.clear': 'Clear',
      'chat.error': 'Channel unavailable: ',
      'chat.foot': 'Answers only quote the Holy Light teachings verbatim, with the title and date.',
      'chat.you': 'You',
      'chat.name': 'Xiao Guang',
      'float.hint': 'Xiao Guang · click for a passage',
      'float.title': 'Xiao Guang ✨ floating passage',
      'float.traits': 'Spiritual · Luminous · Wise',
      'float.note': 'Every random while, one short passage appears at the bottom-right.',
      'float.off': 'Off',
      'float.minUnit': ' min',
      'float.now': 'Read one now',
      'float.close': 'Close',
      'float.again': 'Another',
      'float.hide': 'Hide',
      'float.foot': 'Quoted verbatim from the Holy Light teachings, with title and date.',
      'float.desktopTitle': 'Desktop window',
      'float.desktopNote': 'Floats above all windows; stays visible when DSH is minimized',
      'float.desktopStart': 'Open',
      'float.desktopStop': 'Close',
      'float.desktopBusy': 'Working…',
      'float.autoTitle': 'Auto-show when DSH starts',
      'float.autoNote': 'Appears on the next DSH launch; also toggleable from the menu bar',
      'float.autoOn': 'On',
      'float.autoOff': 'Off',
    };

    let tr = (key) => ZH[key] || key;

    /* ---------- 主题：只用 --dsw-alias-* token ---------- */

    const C = {
      layer1: 'var(--dsw-alias-bg-layer-1)',
      layer2: 'var(--dsw-alias-bg-layer-2)',
      border1: 'var(--dsw-alias-border-l1)',
      border2: 'var(--dsw-alias-border-l2)',
      text: 'var(--dsw-alias-label-primary)',
      dim: 'var(--dsw-alias-label-secondary)',
      brand: 'var(--dsw-alias-brand-primary)',
    };

    const S = {
      page: {
        height: '100%',
        overflowY: 'auto',
        overscrollBehavior: 'contain',
        color: C.text,
        fontSize: 13,
        lineHeight: 1.7,
      },
      inner: {
        maxWidth: 860,
        margin: '0 auto',
        paddingTop: 'calc(var(--dsh-frame-top-clearance, 0px) + 28px)',
        paddingLeft: 'calc(var(--dsh-frame-leading-clearance, 0px) + 28px)',
        paddingRight: 28,
        paddingBottom: 64,
        boxSizing: 'border-box',
      },
      header: { display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '10px 14px', marginBottom: 16 },
      mark: {
        width: 52,
        height: 52,
        flex: 'none',
        borderRadius: 16,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'radial-gradient(circle at 50% 44%, rgba(255,247,225,.95) 0%, rgba(246,214,150,.55) 58%, rgba(240,196,120,.16) 100%)',
        boxShadow: '0 6px 20px rgba(176,138,74,.22)',
      },
      title: { fontSize: 20, fontWeight: 650, letterSpacing: '.01em', lineHeight: 1.35, margin: 0 },
      subtitle: { fontSize: 12.5, color: C.dim, marginTop: 3, lineHeight: 1.55 },
      note: { marginLeft: 'auto', fontSize: 11.5, color: C.dim, whiteSpace: 'nowrap', alignSelf: 'flex-end', paddingBottom: 2 },
      hairline: {
        height: 1,
        margin: '0 0 2px',
        border: 0,
        background:
          'linear-gradient(90deg, rgba(227,192,122,.85), rgba(227,192,122,.18) 38%, transparent 78%)',
      },
      tabs: {
        display: 'flex',
        gap: 24,
        borderBottom: '1px solid ' + C.border1,
        margin: '10px 0 22px',
      },
      tab: (on) => ({
        position: 'relative',
        appearance: 'none',
        border: 0,
        background: 'transparent',
        padding: '8px 1px 11px',
        marginBottom: -1,
        font: 'inherit',
        fontSize: 13.5,
        fontWeight: on ? 600 : 400,
        color: on ? C.text : C.dim,
        cursor: 'pointer',
        borderBottom: '2px solid ' + (on ? C.brand : 'transparent'),
      }),
      sectionHead: {
        display: 'flex',
        alignItems: 'baseline',
        gap: 10,
        margin: '26px 0 12px',
      },
      sectionTitle: { fontSize: 14, fontWeight: 650, letterSpacing: '.02em' },
      sectionCount: { fontSize: 11.5, color: C.dim },
      grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 10 },
      card: {
        background: C.layer1,
        border: '1px solid ' + C.border1,
        borderRadius: 11,
        padding: '13px 15px 14px',
        boxSizing: 'border-box',
      },
      facetCard: { display: 'flex', gap: 10, alignItems: 'flex-start' },
      facetKey: {
        flex: 'none',
        width: 26,
        height: 26,
        borderRadius: 8,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: 13,
        fontWeight: 650,
        color: C.brand,
        background: C.layer2,
        border: '1px solid ' + C.border1,
      },
      facetLabel: { fontSize: 13, fontWeight: 600, lineHeight: 1.5 },
      facetDesc: { fontSize: 12.5, color: C.dim, lineHeight: 1.7, marginTop: 2 },
      quote: {
        background: C.layer1,
        border: '1px solid ' + C.border1,
        borderLeft: '2px solid color-mix(in srgb, ' + C.brand + ' 50%, transparent)',
        borderRadius: 11,
        padding: '13px 16px 14px',
        marginBottom: 10,
        boxSizing: 'border-box',
      },
      quoteHead: { display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' },
      quoteName: { fontSize: 13.5, fontWeight: 650 },
      quoteSrc: { fontSize: 11.5, color: C.dim },
      quoteText: { fontSize: 13.5, lineHeight: 1.9, marginTop: 5, color: C.text },
      form: {
        background: C.layer1,
        border: '1px solid ' + C.border1,
        borderRadius: 12,
        padding: 16,
      },
      fieldLabel: { fontSize: 11.5, color: C.dim, margin: '12px 0 5px' },
      input: {
        width: '100%',
        boxSizing: 'border-box',
        padding: '8px 10px',
        borderRadius: 8,
        border: '1px solid ' + C.border2,
        background: 'transparent',
        color: 'inherit',
        font: 'inherit',
        fontSize: 13,
        outline: 'none',
        resize: 'vertical',
      },
      chips: { display: 'flex', flexWrap: 'wrap', gap: 6 },
      chip: (on) => ({
        appearance: 'none',
        font: 'inherit',
        fontSize: 12,
        lineHeight: 1.5,
        padding: '3px 12px',
        borderRadius: 999,
        cursor: 'pointer',
        color: on ? C.text : C.dim,
        background: on ? 'color-mix(in srgb, ' + C.brand + ' 12%, transparent)' : 'transparent',
        border: '1px solid ' + (on ? 'color-mix(in srgb, ' + C.brand + ' 55%, transparent)' : C.border1),
      }),
      addBtn: {
        appearance: 'none',
        font: 'inherit',
        fontSize: 13,
        fontWeight: 550,
        padding: '7px 18px',
        borderRadius: 8,
        cursor: 'pointer',
        color: C.text,
        background: C.layer2,
        border: '1px solid ' + C.border2,
      },
      rowBetween: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
      delBtn: {
        appearance: 'none',
        font: 'inherit',
        fontSize: 11.5,
        padding: '2px 8px',
        borderRadius: 6,
        cursor: 'pointer',
        color: C.dim,
        background: 'transparent',
        border: '1px solid transparent',
      },
      entryFacet: { fontSize: 12, fontWeight: 600, color: C.brand },
      entryTime: { fontSize: 11, color: C.dim, marginLeft: 'auto' },
      entryLine: { fontSize: 12.5, color: C.dim, marginTop: 3 },
      empty: {
        border: '1px dashed ' + C.border2,
        borderRadius: 11,
        padding: '26px 18px',
        textAlign: 'center',
        fontSize: 12.5,
        color: C.dim,
      },
      stats: { margin: '16px 0 10px', fontSize: 12, color: C.dim, display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' },
      statChip: {
        fontSize: 11.5,
        padding: '1px 9px',
        borderRadius: 999,
        border: '1px solid ' + C.border1,
        color: C.dim,
      },
      foot: { fontSize: 11, color: C.dim, marginTop: 26, opacity: 0.8 },
      floatRoot: {
        position: 'fixed',
        right: 22,
        bottom: 92,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-end',
        gap: 10,
        maxWidth: 360,
        pointerEvents: 'none',
        zIndex: 5,
      },
      floatBubble: {
        pointerEvents: 'auto',
        maxWidth: 340,
        background: C.layer1,
        border: '1px solid ' + C.border1,
        borderLeft: '2px solid color-mix(in srgb, ' + C.brand + ' 55%, transparent)',
        borderRadius: 14,
        padding: '13px 15px 11px',
        boxShadow: '0 10px 30px rgba(120,90,40,.18)',
      },
      floatQuote: { fontSize: 13, lineHeight: 1.95, color: C.text, whiteSpace: 'pre-wrap' },
      floatSrc: { fontSize: 11, color: C.dim, marginTop: 6, textAlign: 'right' },
      floatRow: { display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 9 },
      floatBtn: {
        appearance: 'none',
        font: 'inherit',
        fontSize: 11.5,
        color: C.dim,
        background: 'transparent',
        border: '1px solid ' + C.border1,
        borderRadius: 7,
        padding: '3px 10px',
        cursor: 'pointer',
      },
      floatCard: {
        pointerEvents: 'auto',
        width: 300,
        background: C.layer1,
        border: '1px solid ' + C.border1,
        borderRadius: 14,
        padding: '14px 15px 12px',
        boxShadow: '0 10px 30px rgba(120,90,40,.18)',
      },
      floatTitle: { fontSize: 13, fontWeight: 650, display: 'flex', alignItems: 'center', gap: 6 },
      floatTraits: { fontSize: 11, color: C.dim, letterSpacing: '.08em', marginTop: 2 },
      floatText: { fontSize: 12, color: C.dim, marginTop: 4, lineHeight: 1.7 },
      floatPills: { display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 10 },
      floatPill: (on) => ({
        appearance: 'none',
        font: 'inherit',
        fontSize: 11.5,
        lineHeight: 1.5,
        padding: '2px 10px',
        borderRadius: 999,
        cursor: 'pointer',
        color: on ? C.text : C.dim,
        background: on ? 'color-mix(in srgb, ' + C.brand + ' 12%, transparent)' : 'transparent',
        border: '1px solid ' + (on ? 'color-mix(in srgb, ' + C.brand + ' 55%, transparent)' : C.border1),
      }),
      floatFoot: { fontSize: 11, color: C.dim, marginTop: 10, lineHeight: 1.6, opacity: 0.85 },
      floatDesktop: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 10,
        marginTop: 10,
        paddingTop: 10,
        borderTop: '1px solid ' + C.border1,
      },
      floatDesktopError: {
        fontSize: 11,
        color: 'var(--dsw-alias-state-error-primary)',
        marginTop: 8,
        lineHeight: 1.6,
      },
      floatOrb: (enabled) => ({
        pointerEvents: 'auto',
        appearance: 'none',
        border: 0,
        padding: 0,
        margin: 0,
        width: 72,
        height: 72,
        borderRadius: '50%',
        cursor: 'pointer',
        background: 'radial-gradient(circle at 50% 54%, rgba(255,238,196,.22) 0%, rgba(255,224,160,.08) 55%, transparent 72%)',
        opacity: enabled ? 1 : 0.62,
        filter: 'drop-shadow(0 8px 22px rgba(196,154,84,.4))',
      }),
      chat: { display: 'flex', flexDirection: 'column', gap: 10 },
      chatHead: { display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' },
      chatTitle: { fontSize: 14, fontWeight: 650 },
      chatBox: {
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
        minHeight: 240,
        maxHeight: 'min(56vh, 560px)',
        overflowY: 'auto',
        overscrollBehavior: 'contain',
        padding: '4px 2px 8px',
      },
      msgUser: {
        alignSelf: 'flex-end',
        maxWidth: '82%',
        background: C.layer2,
        border: '1px solid ' + C.border1,
        borderRadius: 12,
        padding: '9px 13px 10px',
      },
      msgBot: {
        alignSelf: 'stretch',
        background: C.layer1,
        border: '1px solid ' + C.border1,
        borderLeft: '2px solid color-mix(in srgb, ' + C.brand + ' 50%, transparent)',
        borderRadius: 12,
        padding: '10px 14px 11px',
      },
      msgWho: { fontSize: 11, color: C.dim, marginBottom: 4 },
      msgText: { fontSize: 13.5, lineHeight: 1.85, whiteSpace: 'pre-wrap', wordBreak: 'break-word' },
      msgTextUser: { fontSize: 13, lineHeight: 1.7, whiteSpace: 'pre-wrap', wordBreak: 'break-word' },
      chatInputRow: { display: 'flex', gap: 8, alignItems: 'flex-end' },
      chatError: {
        fontSize: 12,
        color: 'var(--dsw-alias-state-error-primary)',
        background: 'color-mix(in srgb, var(--dsw-alias-state-error-primary) 8%, transparent)',
        border: '1px solid color-mix(in srgb, var(--dsw-alias-state-error-primary) 28%, transparent)',
        borderRadius: 8,
        padding: '7px 10px',
      },
    };

    const CSS = `
      .dapusa-tab:hover { color: var(--dsw-alias-label-primary); }
      .dapusa-chip:hover { border-color: var(--dsw-alias-border-l2); color: var(--dsw-alias-label-primary); }
      .dapusa-btn:hover { border-color: var(--dsw-alias-label-secondary); }
      .dapusa-del:hover { color: var(--dsw-alias-state-error-primary); border-color: var(--dsw-alias-border-l1); }
      .dapusa-card { transition: border-color .2s ease, box-shadow .2s ease; }
      .dapusa-card:hover { border-color: var(--dsw-alias-border-l2); }
      .dapusa-tab:focus-visible, .dapusa-btn:focus-visible, .dapusa-chip:focus-visible, .dapusa-del:focus-visible, .dapusa-input:focus-visible {
        outline: 2px solid var(--dsw-alias-brand-primary);
        outline-offset: 2px;
      }
    `;

    const FLOAT_CSS = `
      .dapusa-float-orb { animation: dapusa-float-bob 5.6s ease-in-out infinite; }
      .dapusa-float-orb:focus-visible { outline: 2px solid var(--dsw-alias-brand-primary); outline-offset: 3px; border-radius: 50%; }
      .dapusa-float-bubble { animation: dapusa-float-in .32s ease-out; }
      .dapusa-float-card { animation: dapusa-float-in .22s ease-out; }
      .dapusa-float-btn:hover { border-color: var(--dsw-alias-border-l2); color: var(--dsw-alias-label-primary); }
      .dapusa-float-pill:hover { border-color: var(--dsw-alias-label-secondary); color: var(--dsw-alias-label-primary); }
      @keyframes dapusa-float-bob {
        0%, 100% { transform: translateY(0); }
        50% { transform: translateY(-4px); }
      }
      @keyframes dapusa-float-in {
        from { opacity: 0; transform: translateY(6px); }
        to { opacity: 1; transform: translateY(0); }
      }
      .dapusa-xg-aura { animation: dapusa-xg-breathe 4.6s ease-in-out infinite; }
      .dapusa-xg-orbit { transform-box: fill-box; transform-origin: 50% 50%; animation: dapusa-xg-spin 16s linear infinite; }
      .dapusa-xg-sway { transform-box: fill-box; transform-origin: 50% 78%; animation: dapusa-xg-sway 3.8s ease-in-out infinite; }
      .dapusa-xg-eyes { transform-box: fill-box; transform-origin: 50% 50%; animation: dapusa-xg-blink 4.6s infinite; }
      .dapusa-xg-ahoge { transform-box: fill-box; transform-origin: 50% 100%; animation: dapusa-xg-wiggle 2.8s ease-in-out infinite; }
      .dapusa-xg-twinkle { animation: dapusa-xg-twinkle 3.2s ease-in-out infinite; }
      @keyframes dapusa-xg-spin { to { transform: rotate(360deg); } }
      @keyframes dapusa-xg-breathe { 0%, 100% { opacity: .72; } 50% { opacity: 1; } }
      @keyframes dapusa-xg-sway {
        0%, 100% { transform: rotate(-2.2deg); }
        50% { transform: rotate(2.2deg); }
      }
      @keyframes dapusa-xg-blink {
        0%, 92%, 100% { transform: scaleY(1); }
        94% { transform: scaleY(0.08); }
        96% { transform: scaleY(1); }
      }
      @keyframes dapusa-xg-wiggle {
        0%, 100% { transform: rotate(-7deg); }
        50% { transform: rotate(9deg); }
      }
      @keyframes dapusa-xg-twinkle { 0%, 100% { opacity: .5; } 50% { opacity: 1; } }
      @media (prefers-reduced-motion: reduce) {
        .dapusa-float-orb, .dapusa-float-bubble, .dapusa-float-card,
        .dapusa-xg-aura, .dapusa-xg-orbit, .dapusa-xg-sway, .dapusa-xg-eyes,
        .dapusa-xg-ahoge, .dapusa-xg-twinkle { animation: none; }
      }
    `;

    /* ---------- 记录存储 ---------- */

    function loadJournal() {
      try {
        const raw = JSON.parse(localStorage.getItem(JOURNAL_KEY) || '[]');
        if (!Array.isArray(raw)) return [];
        return raw
          .filter((x) => x && (x.id || x.at))
          .map((x) => (x.id ? x : { ...x, id: 'legacy-' + x.at }));
      } catch {
        return [];
      }
    }

    function saveJournal(list) {
      try {
        localStorage.setItem(JOURNAL_KEY, JSON.stringify(list));
      } catch {
        /* 存储不可用时静默降级，页面照常可用 */
      }
    }

    function uid() {
      return Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 7);
    }

    function loadChat() {
      try {
        const raw = JSON.parse(localStorage.getItem(CHAT_KEY) || '[]');
        if (!Array.isArray(raw)) return [];
        return raw
          .filter((m) => m && (m.role === 'user' || m.role === 'assistant') && typeof m.text === 'string')
          .slice(-60);
      } catch {
        return [];
      }
    }

    function saveChat(list) {
      try {
        localStorage.setItem(CHAT_KEY, JSON.stringify(list.slice(-60)));
      } catch {
        /* 存储不可用时只保留内存里的对话 */
      }
    }

    function loadFloatSettings() {
      try {
        const raw = JSON.parse(localStorage.getItem(FLOAT_KEY) || 'null');
        if (raw && typeof raw === 'object') {
          const minutes = Number(raw.minutes);
          return {
            enabled: raw.enabled !== false,
            minutes: FLOAT_MINUTES.includes(minutes) && minutes > 0 ? minutes : FLOAT_DEFAULTS.minutes,
          };
        }
      } catch {
        /* 配置读不到就用默认值 */
      }
      return { ...FLOAT_DEFAULTS };
    }

    function saveFloatSettings(value) {
      try {
        localStorage.setItem(FLOAT_KEY, JSON.stringify(value));
      } catch {
        /* 存储不可用时只在本次运行生效 */
      }
    }

    /* ---------- 页面 ---------- */

    function Tabs({ tab, onPick, T }) {
      return h('div', { style: S.tabs, role: 'tablist' },
        h('button', {
          type: 'button', role: 'tab', 'aria-selected': tab === 'study',
          className: 'dapusa-tab', style: S.tab(tab === 'study'),
          onClick: () => onPick('study'),
        }, T('tab.study')),
        h('button', {
          type: 'button', role: 'tab', 'aria-selected': tab === 'practice',
          className: 'dapusa-tab', style: S.tab(tab === 'practice'),
          onClick: () => onPick('practice'),
        }, T('tab.practice')),
        h('button', {
          type: 'button', role: 'tab', 'aria-selected': tab === 'ask',
          className: 'dapusa-tab', style: S.tab(tab === 'ask'),
          onClick: () => onPick('ask'),
        }, T('tab.ask'))
      );
    }

    function SectionHead({ title, count, T }) {
      return h('div', { style: S.sectionHead },
        h('div', { style: S.sectionTitle }, title),
        typeof count === 'number' ? h('div', { style: S.sectionCount }, String(count)) : null
      );
    }

    function Study({ T }) {
      return h(React.Fragment, null,
        h(SectionHead, { title: T('section.facets'), count: FACETS.length }),
        h('div', { style: S.grid },
          FACETS.map((f) => h('div', { key: f.key, className: 'dapusa-card', style: S.card },
            h('div', { style: S.facetCard },
              h('div', { style: S.facetKey }, f.key),
              h('div', null,
                h('div', { style: S.facetLabel }, f.label),
                h('div', { style: S.facetDesc }, f.desc)
              )
            )
          ))
        ),

        h(SectionHead, { title: T('section.standards'), count: STANDARDS.length }),
        STANDARDS.map((s) => h('div', { key: s.name, className: 'dapusa-card', style: S.quote },
          h('div', { style: S.quoteHead },
            h('div', { style: S.quoteName }, s.name),
            h('div', { style: S.quoteSrc }, s.src)
          ),
          h('div', { style: S.quoteText }, '「' + s.text + '」')
        )),

        h(SectionHead, { title: T('section.practices'), count: PRACTICES.length }),
        PRACTICES.map((p) => h('div', { key: p.name, className: 'dapusa-card', style: S.quote },
          h('div', { style: S.quoteHead },
            h('div', { style: S.quoteName }, p.name),
            h('div', { style: S.quoteSrc }, p.src)
          ),
          h('div', { style: S.quoteText }, '「' + p.text + '」')
        ))
      );
    }

    function Practice({ T }) {
      const [list, setList] = useState(loadJournal);
      const [facet, setFacet] = useState('观');
      const [state, setState] = useState('');
      const [task, setTask] = useState('');
      const [feel, setFeel] = useState('');

      const add = useCallback(() => {
        const s = state.trim();
        const t = task.trim();
        const f = feel.trim();
        if (!s && !t && !f) return;
        const next = [{ id: uid(), at: Date.now(), facet, state: s, task: t, feel: f }, ...list];
        setList(next);
        saveJournal(next);
        setState(''); setTask(''); setFeel('');
      }, [list, facet, state, task, feel]);

      const del = useCallback((id) => {
        const next = list.filter((x) => x.id !== id);
        setList(next);
        saveJournal(next);
      }, [list]);

      const stats = useMemo(() => {
        const c = {};
        for (const x of list) c[x.facet] = (c[x.facet] || 0) + 1;
        return FACETS.map((f) => ({ ...f, n: c[f.key] || 0 })).filter((f) => f.n > 0);
      }, [list]);

      return h(React.Fragment, null,
        h('div', { style: S.form },
          h('div', { style: { fontSize: 14, fontWeight: 650 } }, T('journal.title')),
          h('div', { style: S.fieldLabel }, T('journal.facet')),
          h('div', { style: S.chips },
            FACETS.map((f) => h('button', {
              key: f.key, type: 'button', className: 'dapusa-chip',
              'aria-pressed': facet === f.key,
              style: S.chip(facet === f.key),
              onClick: () => setFacet(f.key),
            }, f.label))
          ),

          h('div', { style: S.fieldLabel }, T('journal.state')),
          h('textarea', {
            className: 'dapusa-input', style: S.input, rows: 2,
            placeholder: T('journal.stateHint'), value: state,
            onChange: (e) => setState(e.target.value),
          }),

          h('div', { style: S.fieldLabel }, T('journal.task')),
          h('input', {
            className: 'dapusa-input', style: S.input,
            placeholder: T('journal.taskHint'), value: task,
            onChange: (e) => setTask(e.target.value),
          }),

          h('div', { style: S.fieldLabel }, T('journal.feel')),
          h('input', {
            className: 'dapusa-input', style: S.input,
            placeholder: T('journal.feelHint'), value: feel,
            onChange: (e) => setFeel(e.target.value),
          }),

          h('div', { style: { ...S.rowBetween, justifyContent: 'flex-end', marginTop: 14 } },
            h('button', { type: 'button', className: 'dapusa-btn', style: S.addBtn, onClick: add }, T('journal.add'))
          )
        ),

        stats.length
          ? h('div', { style: S.stats },
              T('journal.stats'),
              stats.map((s) => h('span', { key: s.key, style: S.statChip }, s.key + ' ' + s.n))
            )
          : null,

        h('div', { style: { height: 12 } }),

        list.length === 0
          ? h('div', { style: S.empty }, T('journal.empty'))
          : list.map((x) => h('div', { key: x.id, className: 'dapusa-card', style: S.quote },
              h('div', { style: S.rowBetween },
                h('div', { style: S.entryFacet }, '〔' + x.facet + '〕'),
                h('div', { style: S.entryTime }, new Date(x.at).toLocaleString()),
                h('button', {
                  type: 'button', className: 'dapusa-del', style: S.delBtn,
                  onClick: () => del(x.id),
                }, T('journal.delete'))
              ),
              x.state ? h('div', { style: S.quoteText }, x.state) : null,
              x.task ? h('div', { style: S.entryLine }, T('journal.task') + '：' + x.task) : null,
              x.feel ? h('div', { style: S.entryLine }, T('journal.feel') + '：' + x.feel) : null
            )),

        h('div', { style: S.foot }, T('journal.onscreen'))
      );
    }

    /* ---------- 问小光：和记忆智能体对话 ---------- */

    function Chat({ T }) {
      const [messages, setMessages] = useState(loadChat);
      const [input, setInput] = useState('');
      const [sending, setSending] = useState(false);
      const [error, setError] = useState('');
      const boxRef = useRef(null);

      useEffect(() => {
        const el = boxRef.current;
        if (el) el.scrollTop = el.scrollHeight;
      }, [messages, sending, error]);

      const send = useCallback(async () => {
        const question = input.trim();
        if (!question || sending) return;
        const history = messages.slice(-8).map(({ role, text }) => ({ role, text }));
        const withQuestion = [...messages, { id: uid(), role: 'user', text: question, at: Date.now() }];
        setMessages(withQuestion);
        saveChat(withQuestion);
        setInput('');
        setSending(true);
        setError('');
        try {
          const response = await fetch('api/dapusa/chat', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ question, history }),
          });
          const data = await response.json().catch(() => null);
          if (!response.ok || !data || data.ok !== true) {
            throw new Error((data && data.error && data.error.message) || 'HTTP ' + response.status);
          }
          const answered = [...withQuestion, { id: uid(), role: 'assistant', text: String(data.answer || ''), at: Date.now() }];
          setMessages(answered);
          saveChat(answered);
        } catch (err) {
          setError(String((err && err.message) || err));
        } finally {
          setSending(false);
        }
      }, [input, sending, messages]);

      const clear = useCallback(() => {
        setMessages([]);
        saveChat([]);
        setError('');
      }, []);

      const shown = messages.length
        ? messages
        : [{ id: 'greeting', role: 'assistant', text: T('chat.greeting'), at: 0 }];

      return h('div', { style: S.chat },
        h('div', { style: S.chatHead },
          h('div', { style: S.chatTitle }, T('chat.title')),
          messages.length
            ? h('button', { type: 'button', className: 'dapusa-del', style: S.delBtn, onClick: clear }, T('chat.clear'))
            : null
        ),
        h('div', { ref: boxRef, style: S.chatBox },
          shown.map((m) => h('div', { key: m.id, style: m.role === 'user' ? S.msgUser : S.msgBot },
            h('div', { style: S.msgWho }, m.role === 'user' ? T('chat.you') : T('chat.name')),
            h('div', { style: m.role === 'user' ? S.msgTextUser : S.msgText }, m.text)
          )),
          sending
            ? h('div', { style: S.msgBot },
                h('div', { style: S.msgWho }, T('chat.name')),
                h('div', { style: { ...S.msgText, color: C.dim } }, T('chat.thinking'))
              )
            : null,
          error ? h('div', { style: S.chatError }, T('chat.error') + error) : null
        ),
        h('div', { style: S.chatInputRow },
          h('textarea', {
            className: 'dapusa-input', style: S.input, rows: 2, maxLength: 500,
            placeholder: T('chat.placeholder'), value: input, disabled: sending,
            onChange: (e) => setInput(e.target.value),
            onKeyDown: (e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            },
          }),
          h('button', {
            type: 'button', className: 'dapusa-btn',
            style: { ...S.addBtn, opacity: sending || !input.trim() ? 0.55 : 1, cursor: sending ? 'default' : 'pointer' },
            onClick: send, disabled: sending || !input.trim(),
          }, T('chat.send'))
        ),
        h('div', { style: S.foot }, T('chat.foot'))
      );
    }

    /* ---------- 浮动小光：随机念一句短法义 ---------- */

    function pickFloatQuote(previous) {
      const pool = FLOAT_QUOTES;
      for (let attempt = 0; attempt < 8; attempt++) {
        const quote = pool[Math.floor(Math.random() * pool.length)];
        if (quote && quote.text !== previous) return quote;
      }
      return pool[0];
    }

    /* 小光 · 机灵的小光精灵：聪慧（亮眼睛、挑眉、眉间觉知光、好奇看着光球）、
       灵活（歪头、眨眼、飞旋光轨、飘带、轻盈浮动） */
    function XiaoguangFigure({ size = 68, uid = 'xg' }) {
      const aura = uid + '-aura';
      const core = uid + '-core';
      const robe = uid + '-robe';
      const svgRef = useRef(null);
      const [gaze, setGaze] = useState({ x: 0, y: 0 });

      // 聪慧：眼珠跟着鼠标轻轻转
      useEffect(() => {
        const onMove = (event) => {
          const element = svgRef.current;
          if (!element) return;
          const rect = element.getBoundingClientRect();
          if (!rect.width || !rect.height) return;
          const centerX = rect.left + rect.width * 0.5;
          const centerY = rect.top + rect.height * 0.42;
          const dx = Math.max(-1, Math.min(1, ((event.clientX - centerX) / rect.width) * 1.6));
          const dy = Math.max(-1, Math.min(1, ((event.clientY - centerY) / rect.height) * 1.6));
          setGaze({ x: dx * 1.15, y: dy * 0.95 });
        };
        window.addEventListener('mousemove', onMove, { passive: true });
        return () => window.removeEventListener('mousemove', onMove);
      }, []);

      const gazeTransform = 'translate(' + gaze.x.toFixed(2) + ' ' + gaze.y.toFixed(2) + ')';
      return h('svg', { ref: svgRef, width: size, height: size, viewBox: '0 0 64 64', 'aria-hidden': true },
        h('defs', null,
          h('radialGradient', { id: aura, cx: '50%', cy: '50%', r: '50%' },
            h('stop', { offset: '0%', stopColor: 'rgba(255,232,178,0.52)' }),
            h('stop', { offset: '62%', stopColor: 'rgba(255,220,150,0.16)' }),
            h('stop', { offset: '100%', stopColor: 'rgba(255,220,150,0)' })
          ),
          h('radialGradient', { id: core, cx: '42%', cy: '32%', r: '70%' },
            h('stop', { offset: '0%', stopColor: '#fffef9' }),
            h('stop', { offset: '52%', stopColor: '#ffedc2' }),
            h('stop', { offset: '100%', stopColor: '#f2c982' })
          ),
          h('linearGradient', { id: robe, x1: '0', y1: '0', x2: '0', y2: '1' },
            h('stop', { offset: '0%', stopColor: '#fffdf4' }),
            h('stop', { offset: '55%', stopColor: '#ffe9b8' }),
            h('stop', { offset: '100%', stopColor: '#eec27a' })
          )
        ),
        h('circle', { className: 'dapusa-xg-aura', cx: 32, cy: 33, r: 30, fill: 'url(#' + aura + ')' }),

        // 飞旋的光轨：聪慧的灵光在脑袋周围转
        h('g', { className: 'dapusa-xg-orbit', fill: 'none' },
          h('circle', {
            cx: 32, cy: 29.5, r: 18.5, stroke: '#e9c684', strokeWidth: 0.9,
            strokeDasharray: '2 5', strokeLinecap: 'round', opacity: 0.4,
          }),
          h('path', { d: 'M45.1 14.9l.8 2 2 .8-2 .8-.8 2-.8-2-2-.8 2-.8z', fill: '#fbe7ae', opacity: 0.95 }),
          h('path', { d: 'M17.4 39.4l.6 1.5 1.5.6-1.5.6-.6 1.5-.6-1.5-1.5-.6 1.5-.6z', fill: '#fbe7ae', opacity: 0.7 })
        ),

        h('g', { className: 'dapusa-xg-sway' },
          // 灵活：两条飘起来的尾光
          h('path', {
            d: 'M40 47C47 46.5 51 43.5 53.5 38.5', fill: 'none',
            stroke: '#e7bd78', strokeWidth: 1.6, strokeLinecap: 'round', opacity: 0.65,
          }),
          h('path', {
            d: 'M39 51C46 50.6 50 47.6 52 43', fill: 'none',
            stroke: '#e7bd78', strokeWidth: 1.1, strokeLinecap: 'round', opacity: 0.4,
          }),
          h('path', { d: 'M54.4 36.2l.7 1.7 1.7.7-1.7.7-.7 1.7-.7-1.7-1.7-.7 1.7-.7z', fill: '#f7dc95', opacity: 0.9 }),

          // 光之衣
          h('path', {
            d: 'M32 36.8C25.6 36.8 21.9 41.6 20.9 46.9 20.2 50.6 21.2 52.6 23.7 52.6L40.3 52.6C42.8 52.6 43.8 50.5 43.1 46.9 42.1 41.6 38.4 36.8 32 36.8Z',
            fill: 'url(#' + robe + ')', stroke: '#c99a52', strokeWidth: 0.8, strokeOpacity: 0.55,
          }),
          h('path', { d: 'M29.6 37.5L32 39.9 34.4 37.5', fill: 'none', stroke: '#c99a52', strokeWidth: 0.9, strokeOpacity: 0.45, strokeLinecap: 'round' }),

          // 轻盈悬浮的底光
          h('path', {
            d: 'M19 56.2C24 59.6 40 59.6 45 55.8', fill: 'none',
            stroke: '#e7bd78', strokeWidth: 1.5, strokeLinecap: 'round', opacity: 0.55,
          }),
          h('path', {
            d: 'M24 57.8C29 60.2 35 60.2 40 57.6', fill: 'none',
            stroke: '#e7bd78', strokeWidth: 1, strokeLinecap: 'round', opacity: 0.3,
          }),

          // 歪着脑袋的小光（灵活）
          h('g', { transform: 'rotate(-5 32 28)' },
            h('path', {
              className: 'dapusa-xg-ahoge',
              d: 'M29.2 18.6C28.2 15.2 30.4 13.2 33.4 14.1 36 14.9 35.4 17.9 33.2 18.4',
              fill: 'none', stroke: '#e2b566', strokeWidth: 1.7, strokeLinecap: 'round',
            }),
            h('circle', {
              cx: 32, cy: 28, r: 10.3, fill: 'url(#' + core + ')',
              stroke: '#c99a52', strokeWidth: 0.8, strokeOpacity: 0.55,
            }),
            // 眉间觉知光
            h('path', {
              className: 'dapusa-xg-twinkle',
              d: 'M32 20.4l.75 1.65 1.65.75-1.65.75-.75 1.65-.75-1.65-1.65-.75 1.65-.75z',
              fill: '#fffef8',
            }),
            // 聪慧的挑眉
            h('path', { d: 'M25.5 23.3C26.7 22.4 28.1 22.3 29.3 22.8', fill: 'none', stroke: '#8a6329', strokeWidth: 1.05, strokeLinecap: 'round' }),
            h('path', { d: 'M34.7 22.7C35.9 22.2 37.3 22.3 38.5 23.2', fill: 'none', stroke: '#8a6329', strokeWidth: 1.05, strokeLinecap: 'round' }),
            // 亮眼睛（会眨，还会跟着你看）
            h('g', { className: 'dapusa-xg-eyes' },
              h('g', { transform: gazeTransform },
                h('ellipse', { cx: 28.1, cy: 27.8, rx: 2.05, ry: 2.5, transform: 'rotate(-5 28.1 27.8)', fill: '#5a3d15' }),
                h('circle', { cx: 28.75, cy: 26.8, r: 0.72, fill: '#fffdf5' }),
                h('circle', { cx: 27.5, cy: 28.8, r: 0.36, fill: '#fffdf5', opacity: 0.85 }),
                h('ellipse', { cx: 35.9, cy: 27.6, rx: 2.05, ry: 2.5, transform: 'rotate(5 35.9 27.6)', fill: '#5a3d15' }),
                h('circle', { cx: 36.55, cy: 26.6, r: 0.72, fill: '#fffdf5' }),
                h('circle', { cx: 35.3, cy: 28.6, r: 0.36, fill: '#fffdf5', opacity: 0.85 })
              )
            ),
            // 温暖的脸颊
            h('circle', { cx: 25.9, cy: 31.3, r: 1.35, fill: '#f3c78a', opacity: 0.35 }),
            h('circle', { cx: 38.1, cy: 31.1, r: 1.35, fill: '#f3c78a', opacity: 0.35 }),
            // 有点调皮的微笑
            h('path', {
              d: 'M29.7 32.3C30.9 33.8 33.3 34 34.6 32.6', fill: 'none',
              stroke: '#8a6329', strokeWidth: 1.2, strokeLinecap: 'round',
            })
          )
        ),

        // 好奇地盯着看的灵光球（聪慧）
        h('g', { className: 'dapusa-xg-twinkle' },
          h('circle', { cx: 16.6, cy: 20.8, r: 3.1, fill: '#fff6d9', opacity: 0.95 }),
          h('circle', { cx: 16.6, cy: 20.8, r: 5.4, fill: '#ffe9b0', opacity: 0.22 }),
          h('path', { d: 'M21.8 15.6l.6 1.5 1.5.6-1.5.6-.6 1.5-.6-1.5-1.5-.6 1.5-.6z', fill: '#fbe7ae', opacity: 0.9 })
        ),

        // 周围的小光点
        h('path', { className: 'dapusa-xg-twinkle', d: 'M12.6 34.8l.6 1.5 1.5.6-1.5.6-.6 1.5-.6-1.5-1.5-.6 1.5-.6z', fill: '#fbe7ae', opacity: 0.7 }),
        h('path', { className: 'dapusa-xg-twinkle', d: 'M50.2 27.6l.55 1.4 1.4.55-1.4.55-.55 1.4-.55-1.4-1.4-.55 1.4-.55z', fill: '#fbe7ae', opacity: 0.6 })
      );
    }

    function FloatAgent({ t }) {
      const T = t || tr;
      const [settings, setSettings] = useState(loadFloatSettings);
      const [quote, setQuote] = useState(null);
      const [shown, setShown] = useState(false);
      const [panel, setPanel] = useState(false);
      const lastRef = useRef('');
      const timerRef = useRef(null);
      const hideRef = useRef(null);
      const panelRef = useRef(false);
      const [desktop, setDesktop] = useState({ running: false });
      const [desktopBusy, setDesktopBusy] = useState(false);
      const [desktopError, setDesktopError] = useState('');

      useEffect(() => {
        panelRef.current = panel;
      }, [panel]);

      const showQuote = useCallback(() => {
        const next = pickFloatQuote(lastRef.current);
        if (!next) return;
        lastRef.current = next.text;
        setQuote(next);
        setShown(true);
        window.clearTimeout(hideRef.current);
        hideRef.current = window.setTimeout(() => setShown(false), FLOAT_SHOW_MS);
      }, []);

      const applySettings = useCallback((next) => {
        setSettings(next);
        saveFloatSettings(next);
      }, []);

      const desktopRequest = useCallback(async (action) => {
        const response = await fetch('api/dapusa/desktop-float', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ action, minutes: settings.minutes }),
        });
        const data = await response.json().catch(() => null);
        if (!response.ok || !data || data.ok !== true) {
          throw new Error((data && data.error && data.error.message) || 'HTTP ' + response.status);
        }
        if (data.result && data.result.error) throw new Error(data.result.error);
        return data.result || { running: false };
      }, [settings.minutes]);

      const refreshDesktop = useCallback(async () => {
        try {
          setDesktop(await desktopRequest('status'));
        } catch {
          /* 通道不可用时保持当前显示 */
        }
      }, [desktopRequest]);

      useEffect(() => {
        if (panel) refreshDesktop();
      }, [panel, refreshDesktop]);

      const toggleDesktop = useCallback(async () => {
        if (desktopBusy) return;
        setDesktopBusy(true);
        setDesktopError('');
        try {
          setDesktop(await desktopRequest(desktop.running ? 'stop' : 'start'));
        } catch (error) {
          setDesktopError(String((error && error.message) || error));
        } finally {
          setDesktopBusy(false);
        }
      }, [desktop.running, desktopBusy, desktopRequest]);

      const toggleAuto = useCallback(async () => {
        if (desktopBusy) return;
        setDesktopBusy(true);
        setDesktopError('');
        try {
          setDesktop(await desktopRequest(desktop.autoStart ? 'auto-off' : 'auto-on'));
        } catch (error) {
          setDesktopError(String((error && error.message) || error));
        } finally {
          setDesktopBusy(false);
        }
      }, [desktop.autoStart, desktopBusy, desktopRequest]);

      useEffect(() => () => {
        window.clearTimeout(timerRef.current);
        window.clearTimeout(hideRef.current);
      }, []);

      useEffect(() => {
        window.clearTimeout(timerRef.current);
        if (!settings.enabled) {
          setShown(false);
          return undefined;
        }
        let cancelled = false;
        const base = settings.minutes * 60000;
        const schedule = (delay) => {
          timerRef.current = window.setTimeout(() => {
            if (cancelled) return;
            if (!panelRef.current) showQuote();
            const jitter = 0.6 + Math.random() * 0.8;
            schedule(Math.max(45000, Math.round(base * jitter)));
          }, delay);
        };
        schedule(Math.round(15000 + Math.random() * 30000));
        return () => {
          cancelled = true;
          window.clearTimeout(timerRef.current);
        };
      }, [settings.enabled, settings.minutes, showQuote]);

      const togglePanel = useCallback(() => {
        setPanel((open) => !open);
        if (!quote) showQuote();
      }, [quote, showQuote]);

      return h('div', { style: S.floatRoot },
        h('style', null, FLOAT_CSS),

        panel
          ? h('div', { className: 'dapusa-float-card', style: S.floatCard },
              h('div', { style: S.floatTitle }, T('float.title')),
              h('div', { style: S.floatTraits }, T('float.traits')),
              h('div', { style: S.floatText }, T('float.note')),
              h('div', { style: S.floatPills },
                FLOAT_MINUTES.map((minutes) => {
                  const on = minutes === 0 ? !settings.enabled : settings.enabled && settings.minutes === minutes;
                  return h('button', {
                    key: minutes,
                    type: 'button',
                    className: 'dapusa-float-pill',
                    'aria-pressed': on,
                    style: S.floatPill(on),
                    onClick: () => applySettings(minutes === 0 ? { enabled: false, minutes: settings.minutes } : { enabled: true, minutes }),
                  }, minutes === 0 ? T('float.off') : String(minutes) + T('float.minUnit'));
                })
              ),
              h('div', { style: S.floatRow },
                h('button', { type: 'button', className: 'dapusa-float-btn', style: S.floatBtn, onClick: showQuote }, T('float.now')),
                h('button', { type: 'button', className: 'dapusa-float-btn', style: S.floatBtn, onClick: () => setPanel(false) }, T('float.close'))
              ),
              h('div', { style: S.floatDesktop },
                h('div', null,
                  h('div', { style: { fontSize: 11.5, fontWeight: 600 } }, T('float.autoTitle')),
                  h('div', { style: { fontSize: 10.5, color: C.dim, marginTop: 2, lineHeight: 1.5 } }, T('float.autoNote'))
                ),
                h('button', {
                  type: 'button',
                  className: 'dapusa-float-btn',
                  style: { ...S.floatBtn, opacity: desktopBusy ? 0.6 : 1, cursor: desktopBusy ? 'default' : 'pointer' },
                  onClick: toggleAuto,
                  disabled: desktopBusy,
                }, desktop.autoStart ? T('float.autoOn') : T('float.autoOff'))
              ),
              h('div', { style: S.floatDesktop },
                h('div', null,
                  h('div', { style: { fontSize: 11.5, fontWeight: 600 } }, T('float.desktopTitle')),
                  h('div', { style: { fontSize: 10.5, color: C.dim, marginTop: 2, lineHeight: 1.5 } }, T('float.desktopNote'))
                ),
                h('button', {
                  type: 'button',
                  className: 'dapusa-float-btn',
                  style: { ...S.floatBtn, opacity: desktopBusy ? 0.6 : 1, cursor: desktopBusy ? 'default' : 'pointer' },
                  onClick: toggleDesktop,
                  disabled: desktopBusy,
                }, desktopBusy ? T('float.desktopBusy') : desktop.running ? T('float.desktopStop') : T('float.desktopStart'))
              ),
              desktopError ? h('div', { style: S.floatDesktopError }, desktopError) : null,
              h('div', { style: S.floatFoot }, T('float.foot'))
            )
          : null,

        shown && quote
          ? h('div', { className: 'dapusa-float-bubble', style: S.floatBubble },
              h('div', { style: S.floatQuote }, '「' + quote.text + '」'),
              h('div', { style: S.floatSrc }, '——《' + quote.title + '》' + quote.date),
              h('div', { style: S.floatRow },
                h('button', { type: 'button', className: 'dapusa-float-btn', style: S.floatBtn, onClick: showQuote }, T('float.again')),
                h('button', { type: 'button', className: 'dapusa-float-btn', style: S.floatBtn, onClick: () => setShown(false) }, T('float.hide'))
              )
            )
          : null,

        h('button', {
          type: 'button',
          className: 'dapusa-float-orb',
          style: S.floatOrb(settings.enabled),
          onClick: togglePanel,
          title: T('float.hint'),
          'aria-label': T('float.hint'),
          'aria-expanded': panel,
        }, h(XiaoguangFigure, { size: 72, uid: 'xgFloat' }))
      );
    }

    function Mark() {
      return h('div', { style: S.mark, 'aria-hidden': true },
        h(XiaoguangFigure, { size: 46, uid: 'xgPage' })
      );
    }

    function Page({ t }) {
      const T = t || tr;
      const [tab, setTab] = useState('study');
      return h('div', { style: S.page },
        h('style', null, CSS),
        h('div', { style: S.inner },
          h('div', { style: S.header },
            h(Mark),
            h('div', null,
              h('h1', { style: S.title }, T('panel.title')),
              h('div', { style: S.subtitle }, T('panel.subtitle'))
            ),
            h('div', { style: S.note }, T('panel.note'))
          ),
          h('div', { style: S.hairline }),
          h(Tabs, { tab, onPick: setTab, T }),
          tab === 'study' ? h(Study, { T }) : tab === 'practice' ? h(Practice, { T }) : h(Chat, { T })
        )
      );
    }

    function SidebarIcon({ size, active }) {
      const px = typeof size === 'number' ? size : 16;
      return h('svg', {
        width: px, height: px, viewBox: '0 0 24 24', fill: 'none',
        stroke: 'currentColor', strokeWidth: 1.5,
        strokeLinecap: 'round', strokeLinejoin: 'round',
        'aria-hidden': true, opacity: active ? 1 : 0.92,
      },
        h('circle', { cx: 12, cy: 8.6, r: 2.9 }),
        h('path', { d: 'M6.6 8.2a5.4 5.4 0 0 1 10.8 0', opacity: 0.55 }),
        h('path', { d: 'M12 2.6v1.1' }),
        h('path', { d: 'M17.4 4.2l-.8.8', opacity: 0.6 }),
        h('path', { d: 'M6.6 4.2l.8.8', opacity: 0.6 }),
        h('path', { d: 'M12 12.2c-3.1 0-5 2.6-5.3 5.4-.1 1 .2 1.5.9 1.5h8.8c.7 0 1-.5.9-1.5-.3-2.8-2.2-5.4-5.3-5.4Z' }),
        h('path', { d: 'M10.6 16.6l1.4 1 1.4-1' })
      );
    }

    return {
      inject: ['slots', 'locale'],
      apply(ctx) {
        ctx.effect(() => ctx.locale.register(NS, 'zh', ZH), 'dapusa: zh dictionary');
        ctx.effect(() => ctx.locale.register(NS, 'en', EN), 'dapusa: en dictionary');

        const t = ctx.locale.bind(NS);
        tr = t;

        ctx.slots.inject('main', () => ctx.slots.register({
          name: 'main',
          key: ID,
          locale: NS,
        }, Page));

        ctx.slots.inject('sidebar.panellist', () => ctx.slots.register({
          name: 'sidebar.panellist',
          id: ID,
          order: 30,
          label: () => tr('panel.title'),
          locale: NS,
        }, SidebarIcon));

        // 浮在所有列上面的小光：随机念一句短法义
        ctx.slots.inject('shell.overlay', () => ctx.slots.register({
          name: 'shell.overlay',
          id: 'dsh-dapusa-float',
          order: 40,
          locale: NS,
        }, FloatAgent));
      },
    };
  },
});
