// App Configuration & Global State

export const state = {
    currentTab: 'dashboard',
    selectedWorryText: "나무의사 필기시험",
    selectedPersona: "약초꾼",
    sealHoldTimer: null,
    sealHoldProgress: 0,
    activeStudentId: localStorage.getItem("active_student_id") || "web_student_user",
    cbtQuestions: [],
    allPackQuestions: [],
    currentCbtIndex: 0,
    userCbtAnswers: {},
    cbtSolvedFeedbacks: {},
    isMobileOmrOpen: false,
    cbtReportChartInstance: null,
    cbtGrowthChartInstance: null,
    examsList: [],
    activeExam: null, // { round_name, questions: [] }
    activeQuestionIdx: 0,
    answersSheet: {}, // q_no -> selected_choice (string '1'~'5')
    studentProfile: {
        student_title: "대표님",
        persona_type: "약초꾼",
        user_worry: "나무의사 필기시험"
    },
    examTimerInterval: null,
    examSeconds: 0,
    radarChartInstance: null,
    barChartInstance: null
};

// Tree pathology Latin scientific name to Hangul reading translation mapping
export const SCIENTIFIC_NAMES_DICT = {
    "Ophiostoma novo-ulmi": "오피오스토마 노보울미",
    "Ophiostoma ulmi": "오피오스토마 울미",
    "Ophiostoma": "오피오스토마",
    "Bursaphelenchus xylophilus": "버사펠렌쿠스 자일로필루스 (소나무재선충)",
    "Bursaphelenchus": "버사펠렌쿠스",
    "Phytoplasma": "파이토플라스마",
    "Raffaelea quercus-mongolicae": "라파엘레아 쿠에르쿠스-몽골리카 (참나무시들음병균)",
    "Raffaelea": "라파엘레아",
    "Platypus koryoensis": "플라티푸스 코료엔시스 (광릉긴나무좀)",
    "Platypus": "플라티푸스",
    "Lymantria dispar": "리만트리아 디스파르 (매미나방)",
    "Monochamus alternatus": "모노카무스 알테르나투스 (솔수염하늘소)",
    "Monochamus saltuarius": "모노카무스 살투아리우스 (북방수염하늘소)",
    "Thecodiplosis japonensis": "테코디플로시스 야포넨시스 (솔잎혹파리)",
    "Matsucoccus thunbergianae": "마츠코쿠스 툰베르기아네 (솔껍질깍지벌레)",
    "Cryphonectria parasitica": "크라이포넥트리아 파라시티카 (밤나무 줄기마름병균)",
    "Endothia parasitica": "엔도시아 파라시티카 (밤나무 줄기마름병균)",
    "Cronartium ribicola": "크로나티움 리비콜라 (잣나무 털녹병균)",
    "Coleosporium pini-pomiferae": "콜레오스포리움 피니-포미페레 (소나무 잎녹병균)",
    "Gymnosporangium asiaticum": "짐노스포랑기움 아시아티쿰 (배나무 붉은별무늬병균)",
    "Gymnosporangium haraeanum": "짐노스포랑기움 하래아눔 (향나무 녹병균)",
    "Lophodermium pinastri": "로포더미움 피나스트리 (소나무 잎떨림병균)",
    "Rhytisma acerinum": "리티스마 아세리눔 (단풍나무 타르점무늬병균)",
    "Taphrina deformans": "타프리나 데포르만스 (벚나무 빗자루병균/복숭아나무 잎오그라듦병균)",
    "Agrobacterium tumefaciens": "아그로박테리움 투메파시엔스 (근두암종병균)",
    "Erwinia amylovora": "에르비니아 아밀로보라 (화상병균)",
    "Exobasidium japonicum": "엑소바시디움 야포니쿰 (철쭉류 떡병균)",
    "Exobasidium vexans": "엑소바시디움 벡산스 (차나무 떡병균)",
    "Exobasidium": "엑소바시디움",
    "Pseudomonas syringae": "슈도모나스 시링게 (세균성 갈색무늬병균)"
};
