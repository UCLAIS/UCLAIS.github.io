"use strict";(self.webpackChunkucl_artificial_intelligence_society=self.webpackChunkucl_artificial_intelligence_society||[]).push([[188],{3905:(t,e,a)=>{a.d(e,{Zo:()=>m,kt:()=>k});var n=a(7294);function r(t,e,a){return e in t?Object.defineProperty(t,e,{value:a,enumerable:!0,configurable:!0,writable:!0}):t[e]=a,t}function i(t,e){var a=Object.keys(t);if(Object.getOwnPropertySymbols){var n=Object.getOwnPropertySymbols(t);e&&(n=n.filter((function(e){return Object.getOwnPropertyDescriptor(t,e).enumerable}))),a.push.apply(a,n)}return a}function l(t){for(var e=1;e<arguments.length;e++){var a=null!=arguments[e]?arguments[e]:{};e%2?i(Object(a),!0).forEach((function(e){r(t,e,a[e])})):Object.getOwnPropertyDescriptors?Object.defineProperties(t,Object.getOwnPropertyDescriptors(a)):i(Object(a)).forEach((function(e){Object.defineProperty(t,e,Object.getOwnPropertyDescriptor(a,e))}))}return t}function o(t,e){if(null==t)return{};var a,n,r=function(t,e){if(null==t)return{};var a,n,r={},i=Object.keys(t);for(n=0;n<i.length;n++)a=i[n],e.indexOf(a)>=0||(r[a]=t[a]);return r}(t,e);if(Object.getOwnPropertySymbols){var i=Object.getOwnPropertySymbols(t);for(n=0;n<i.length;n++)a=i[n],e.indexOf(a)>=0||Object.prototype.propertyIsEnumerable.call(t,a)&&(r[a]=t[a])}return r}var u=n.createContext({}),s=function(t){var e=n.useContext(u),a=e;return t&&(a="function"==typeof t?t(e):l(l({},e),t)),a},m=function(t){var e=s(t.components);return n.createElement(u.Provider,{value:e},t.children)},p="mdxType",c={inlineCode:"code",wrapper:function(t){var e=t.children;return n.createElement(n.Fragment,{},e)}},d=n.forwardRef((function(t,e){var a=t.components,r=t.mdxType,i=t.originalType,u=t.parentName,m=o(t,["components","mdxType","originalType","parentName"]),p=s(a),d=r,k=p["".concat(u,".").concat(d)]||p[d]||c[d]||i;return a?n.createElement(k,l(l({ref:e},m),{},{components:a})):n.createElement(k,l({ref:e},m))}));function k(t,e){var a=arguments,r=e&&e.mdxType;if("string"==typeof t||r){var i=a.length,l=new Array(i);l[0]=d;var o={};for(var u in e)hasOwnProperty.call(e,u)&&(o[u]=e[u]);o.originalType=t,o[p]="string"==typeof t?t:r,l[1]=o;for(var s=2;s<i;s++)l[s]=a[s];return n.createElement.apply(null,l)}return n.createElement.apply(null,a)}d.displayName="MDXCreateElement"},2534:(t,e,a)=>{a.r(e),a.d(e,{assets:()=>O,contentTitle:()=>b,default:()=>C,frontMatter:()=>y,metadata:()=>v,toc:()=>w});var n=a(7462),r=a(7294),i=a(3905),l=a(6010),o=a(2802),u=a(9960),s=a(3919),m=a(5999);const p={cardContainer:"cardContainer_fWXF",cardTitle:"cardTitle_rnsV",cardDescription:"cardDescription_PWke"};function c(t){let{href:e,children:a}=t;return r.createElement(u.Z,{href:e,className:(0,l.Z)("card padding--lg",p.cardContainer)},a)}function d(t){let{href:e,icon:a,title:n,description:i}=t;return r.createElement(c,{href:e},r.createElement("h2",{className:(0,l.Z)("text--truncate",p.cardTitle),title:n},a," ",n),i&&r.createElement("p",{className:(0,l.Z)("text--truncate",p.cardDescription),title:i},i))}function k(t){let{item:e}=t;const a=(0,o.Wl)(e);return a?r.createElement(d,{href:a,icon:"\ud83d\uddc3\ufe0f",title:e.label,description:e.description??(0,m.I)({message:"{count} items",id:"theme.docs.DocCard.categoryDescription",description:"The default description for a category card in the generated index about how many items this category includes"},{count:e.items.length})}):null}function g(t){let{item:e}=t;const a=(0,s.Z)(e.href)?"\ud83d\udcc4\ufe0f":"\ud83d\udd17",n=(0,o.xz)(e.docId??void 0);return r.createElement(d,{href:e.href,icon:a,title:e.label,description:e.description??n?.description})}function N(t){let{item:e}=t;switch(e.type){case"link":return r.createElement(g,{item:e});case"category":return r.createElement(k,{item:e});default:throw new Error(`unknown item type ${JSON.stringify(e)}`)}}function f(t){let{className:e}=t;const a=(0,o.jA)();return r.createElement(h,{items:a.items,className:e})}function h(t){const{items:e,className:a}=t;if(!e)return r.createElement(f,t);const n=(0,o.MN)(e);return r.createElement("section",{className:(0,l.Z)("row",a)},n.map(((t,e)=>r.createElement("article",{key:e,className:"col col--6 margin-bottom--lg"},r.createElement(N,{item:t})))))}const y={sidebar_position:1},b="\ud83e\uddd1\u200d\ud83d\udcbb Machine Learning Tutorial Series",v={unversionedId:"tutorials/index",id:"tutorials/index",title:"\ud83e\uddd1\u200d\ud83d\udcbb Machine Learning Tutorial Series",description:"Welcome to season 4 (2023-24) of the beginner machine learning tutorial series of the UCL Artificial Intelligence Society!",source:"@site/our-initiatives/tutorials/index.mdx",sourceDirName:"tutorials",slug:"/tutorials/",permalink:"/our-initiatives/tutorials/",draft:!1,tags:[],version:"current",sidebarPosition:1,frontMatter:{sidebar_position:1},sidebar:"docsSidebar",previous:{title:"Our Initiatives",permalink:"/our-initiatives/"},next:{title:"Welcome",permalink:"/our-initiatives/tutorials/welcome"}},O={},w=[{value:"Our Team",id:"our-team",level:2},{value:"DOXA Challenges",id:"doxa-challenges",level:2},{value:"Curriculum",id:"curriculum",level:2},{value:"Notes",id:"notes",level:2},{value:"Previous Seasons",id:"previous-seasons",level:2}],T={toc:w},x="wrapper";function C(t){let{components:e,...a}=t;return(0,i.kt)(x,(0,n.Z)({},T,a,{components:e,mdxType:"MDXLayout"}),(0,i.kt)("h1",{id:"-machine-learning-tutorial-series"},"\ud83e\uddd1\u200d\ud83d\udcbb Machine Learning Tutorial Series"),(0,i.kt)("p",null,"Welcome to season 4 (2023-24) of the beginner machine learning tutorial series of the UCL Artificial Intelligence Society!"),(0,i.kt)("p",null,"If you have any questions about our content or machine learning more generally, feel free to ask us at the next session or make a forum post on the ",(0,i.kt)("a",{parentName:"p",href:"https://discord.gg/KSUZuQx?ltclid=3f704b3b-9044-415a-a2d7-e41007214187"},"UCLAIS Discord server"),"."),(0,i.kt)("h2",{id:"our-team"},"Our Team"),(0,i.kt)("p",null,"This academic year, the tutorial series is being delivered by the following people:"),(0,i.kt)("ul",null,(0,i.kt)("li",{parentName:"ul"},(0,i.kt)("a",{parentName:"li",href:"#"},"Angela Yu")," (Head of Tutorials)"),(0,i.kt)("li",{parentName:"ul"},(0,i.kt)("a",{parentName:"li",href:"#"},"Damien Bose")," (ML Officer)"),(0,i.kt)("li",{parentName:"ul"},(0,i.kt)("a",{parentName:"li",href:"#"},"Suhail Merali")," (ML Officer)"),(0,i.kt)("li",{parentName:"ul"},(0,i.kt)("a",{parentName:"li",href:"#"},"Arham Ali")," (Tutorials Reviewer)")),(0,i.kt)("h2",{id:"doxa-challenges"},"DOXA Challenges"),(0,i.kt)("p",null,"Our teaching will be supplemented by engaging AI competitions on ",(0,i.kt)("a",{parentName:"p",href:"https://doxaai.com/"},"DOXA")," related to topics such as visual computing, natural language processing and reinforcement learning."),(0,i.kt)("p",null,"To take part and follow along with the tutorial series content, ",(0,i.kt)("a",{parentName:"p",href:"https://doxaai.com/sign-up"},"sign up")," to the platform if you have not done so already."),(0,i.kt)("h2",{id:"curriculum"},"Curriculum"),(0,i.kt)("table",null,(0,i.kt)("thead",{parentName:"table"},(0,i.kt)("tr",{parentName:"thead"},(0,i.kt)("th",{parentName:"tr",align:null},"Week"),(0,i.kt)("th",{parentName:"tr",align:null},"Title"),(0,i.kt)("th",{parentName:"tr",align:null},"Date"),(0,i.kt)("th",{parentName:"tr",align:null},"Links"))),(0,i.kt)("tbody",{parentName:"table"},(0,i.kt)("tr",{parentName:"tbody"},(0,i.kt)("td",{parentName:"tr",align:null},"Week 1"),(0,i.kt)("td",{parentName:"tr",align:null},(0,i.kt)("a",{parentName:"td",href:"/our-initiatives/tutorials/welcome"},"Welcome & Introduction to the ML Landscape")),(0,i.kt)("td",{parentName:"tr",align:null},"2023-10-11"),(0,i.kt)("td",{parentName:"tr",align:null})),(0,i.kt)("tr",{parentName:"tbody"},(0,i.kt)("td",{parentName:"tr",align:null}),(0,i.kt)("td",{parentName:"tr",align:null},(0,i.kt)("a",{parentName:"td",href:"/our-initiatives/tutorials/intro-to-python"},"Introduction to Python")),(0,i.kt)("td",{parentName:"tr",align:null}),(0,i.kt)("td",{parentName:"tr",align:null})),(0,i.kt)("tr",{parentName:"tbody"},(0,i.kt)("td",{parentName:"tr",align:null},"Week 2"),(0,i.kt)("td",{parentName:"tr",align:null},(0,i.kt)("a",{parentName:"td",href:"/our-initiatives/tutorials/linear-models"},"Linear Models")," (including linear & logistic regression)"),(0,i.kt)("td",{parentName:"tr",align:null},"2023-10-18"),(0,i.kt)("td",{parentName:"tr",align:null})),(0,i.kt)("tr",{parentName:"tbody"},(0,i.kt)("td",{parentName:"tr",align:null},"Week 3"),(0,i.kt)("td",{parentName:"tr",align:null},(0,i.kt)("a",{parentName:"td",href:"/our-initiatives/tutorials/knns-svms"},"k-Nearest Neighbours & Support Vector Machines")),(0,i.kt)("td",{parentName:"tr",align:null},"2023-10-25"),(0,i.kt)("td",{parentName:"tr",align:null})),(0,i.kt)("tr",{parentName:"tbody"},(0,i.kt)("td",{parentName:"tr",align:null},"Week 4"),(0,i.kt)("td",{parentName:"tr",align:null},(0,i.kt)("a",{parentName:"td",href:"/our-initiatives/tutorials/neural-networks"},"Neural Networks")),(0,i.kt)("td",{parentName:"tr",align:null},"2023-11-01"),(0,i.kt)("td",{parentName:"tr",align:null})),(0,i.kt)("tr",{parentName:"tbody"},(0,i.kt)("td",{parentName:"tr",align:null}),(0,i.kt)("td",{parentName:"tr",align:null},(0,i.kt)("em",{parentName:"td"},"Reading Week")),(0,i.kt)("td",{parentName:"tr",align:null}),(0,i.kt)("td",{parentName:"tr",align:null})),(0,i.kt)("tr",{parentName:"tbody"},(0,i.kt)("td",{parentName:"tr",align:null},"Week 5"),(0,i.kt)("td",{parentName:"tr",align:null},(0,i.kt)("a",{parentName:"td",href:"/our-initiatives/tutorials/visual-computing-1"},"Visual Computing I")),(0,i.kt)("td",{parentName:"tr",align:null},"2023-11-15"),(0,i.kt)("td",{parentName:"tr",align:null})),(0,i.kt)("tr",{parentName:"tbody"},(0,i.kt)("td",{parentName:"tr",align:null},"Week 6"),(0,i.kt)("td",{parentName:"tr",align:null},(0,i.kt)("a",{parentName:"td",href:"/our-initiatives/tutorials/visual-computing-2"},"Visual Computing II")),(0,i.kt)("td",{parentName:"tr",align:null},"2023-11-22"),(0,i.kt)("td",{parentName:"tr",align:null})),(0,i.kt)("tr",{parentName:"tbody"},(0,i.kt)("td",{parentName:"tr",align:null},"Week 7"),(0,i.kt)("td",{parentName:"tr",align:null},(0,i.kt)("a",{parentName:"td",href:"/our-initiatives/tutorials/rnns"},"Recurrent Neural Networks")," (including LSTMs & GRUs)"),(0,i.kt)("td",{parentName:"tr",align:null},"2023-11-29"),(0,i.kt)("td",{parentName:"tr",align:null})),(0,i.kt)("tr",{parentName:"tbody"},(0,i.kt)("td",{parentName:"tr",align:null},"Week 8"),(0,i.kt)("td",{parentName:"tr",align:null},(0,i.kt)("a",{parentName:"td",href:"/our-initiatives/tutorials/ml-in-practice"},"Machine Learning in Practice")),(0,i.kt)("td",{parentName:"tr",align:null},"2023-12-06"),(0,i.kt)("td",{parentName:"tr",align:null})),(0,i.kt)("tr",{parentName:"tbody"},(0,i.kt)("td",{parentName:"tr",align:null}),(0,i.kt)("td",{parentName:"tr",align:null},(0,i.kt)("a",{parentName:"td",href:"/our-initiatives/tutorials/climatehack-ai"},"ClimateHack.AI 2023")),(0,i.kt)("td",{parentName:"tr",align:null},"2023-12-13"),(0,i.kt)("td",{parentName:"tr",align:null})),(0,i.kt)("tr",{parentName:"tbody"},(0,i.kt)("td",{parentName:"tr",align:null}),(0,i.kt)("td",{parentName:"tr",align:null},(0,i.kt)("em",{parentName:"td"},"End of Term")),(0,i.kt)("td",{parentName:"tr",align:null}),(0,i.kt)("td",{parentName:"tr",align:null})),(0,i.kt)("tr",{parentName:"tbody"},(0,i.kt)("td",{parentName:"tr",align:null},"Week 9"),(0,i.kt)("td",{parentName:"tr",align:null},(0,i.kt)("a",{parentName:"td",href:"/our-initiatives/tutorials/nlp"},"Natural Language Processing I")),(0,i.kt)("td",{parentName:"tr",align:null},"2024-01-10"),(0,i.kt)("td",{parentName:"tr",align:null})),(0,i.kt)("tr",{parentName:"tbody"},(0,i.kt)("td",{parentName:"tr",align:null},"Week 10"),(0,i.kt)("td",{parentName:"tr",align:null},(0,i.kt)("a",{parentName:"td",href:"/our-initiatives/tutorials/nlp"},"Natural Language Processing II")),(0,i.kt)("td",{parentName:"tr",align:null},"2024-01-17"),(0,i.kt)("td",{parentName:"tr",align:null})),(0,i.kt)("tr",{parentName:"tbody"},(0,i.kt)("td",{parentName:"tr",align:null},"Week 11"),(0,i.kt)("td",{parentName:"tr",align:null},(0,i.kt)("a",{parentName:"td",href:"/our-initiatives/tutorials/reinforcement-learning"},"Reinforcement Learning I")),(0,i.kt)("td",{parentName:"tr",align:null},"2024-01-24"),(0,i.kt)("td",{parentName:"tr",align:null})),(0,i.kt)("tr",{parentName:"tbody"},(0,i.kt)("td",{parentName:"tr",align:null},"Week 12"),(0,i.kt)("td",{parentName:"tr",align:null},(0,i.kt)("a",{parentName:"td",href:"/our-initiatives/tutorials/reinforcement-learning"},"Reinforcement Learning II")),(0,i.kt)("td",{parentName:"tr",align:null},"2024-01-31"),(0,i.kt)("td",{parentName:"tr",align:null})))),(0,i.kt)("h2",{id:"notes"},"Notes"),(0,i.kt)(h,{mdxType:"DocCardList"}),(0,i.kt)("h2",{id:"previous-seasons"},"Previous Seasons"),(0,i.kt)("p",null,"The content and resources from previous years are available on GitHub:"),(0,i.kt)("ul",null,(0,i.kt)("li",{parentName:"ul"},(0,i.kt)("a",{parentName:"li",href:"https://github.com/UCLAIS/Machine-Learning-Tutorials"},"Season 1 (2020/21)")," ","\u2013"," led by ",(0,i.kt)("a",{parentName:"li",href:"https://github.com/kimdanny"},"Danny Toeun Kim")),(0,i.kt)("li",{parentName:"ul"},(0,i.kt)("a",{parentName:"li",href:"https://github.com/UCLAIS/ML-Tutorials-Season-2"},"Season 2 (2021/22)")," ","\u2013"," led by ",(0,i.kt)("a",{parentName:"li",href:"https://github.com/MartynasPocius"},"Martynas Pocius")),(0,i.kt)("li",{parentName:"ul"},(0,i.kt)("a",{parentName:"li",href:"https://github.com/UCLAIS/ml-tutorials-season-3"},"Season 3 (2022/23)")," ","\u2013"," led by ",(0,i.kt)("a",{parentName:"li",href:"https://trhlikfilip.com/"},"Filip Trhl\xedk"))))}C.isMDXComponent=!0}}]);