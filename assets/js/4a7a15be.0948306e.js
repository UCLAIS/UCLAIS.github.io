"use strict";(self.webpackChunkucl_artificial_intelligence_society=self.webpackChunkucl_artificial_intelligence_society||[]).push([[188],{3905:(e,t,r)=>{r.d(t,{Zo:()=>u,kt:()=>f});var n=r(7294);function a(e,t,r){return t in e?Object.defineProperty(e,t,{value:r,enumerable:!0,configurable:!0,writable:!0}):e[t]=r,e}function i(e,t){var r=Object.keys(e);if(Object.getOwnPropertySymbols){var n=Object.getOwnPropertySymbols(e);t&&(n=n.filter((function(t){return Object.getOwnPropertyDescriptor(e,t).enumerable}))),r.push.apply(r,n)}return r}function l(e){for(var t=1;t<arguments.length;t++){var r=null!=arguments[t]?arguments[t]:{};t%2?i(Object(r),!0).forEach((function(t){a(e,t,r[t])})):Object.getOwnPropertyDescriptors?Object.defineProperties(e,Object.getOwnPropertyDescriptors(r)):i(Object(r)).forEach((function(t){Object.defineProperty(e,t,Object.getOwnPropertyDescriptor(r,t))}))}return e}function o(e,t){if(null==e)return{};var r,n,a=function(e,t){if(null==e)return{};var r,n,a={},i=Object.keys(e);for(n=0;n<i.length;n++)r=i[n],t.indexOf(r)>=0||(a[r]=e[r]);return a}(e,t);if(Object.getOwnPropertySymbols){var i=Object.getOwnPropertySymbols(e);for(n=0;n<i.length;n++)r=i[n],t.indexOf(r)>=0||Object.prototype.propertyIsEnumerable.call(e,r)&&(a[r]=e[r])}return a}var s=n.createContext({}),c=function(e){var t=n.useContext(s),r=t;return e&&(r="function"==typeof e?e(t):l(l({},t),e)),r},u=function(e){var t=c(e.components);return n.createElement(s.Provider,{value:t},e.children)},p="mdxType",m={inlineCode:"code",wrapper:function(e){var t=e.children;return n.createElement(n.Fragment,{},t)}},d=n.forwardRef((function(e,t){var r=e.components,a=e.mdxType,i=e.originalType,s=e.parentName,u=o(e,["components","mdxType","originalType","parentName"]),p=c(r),d=a,f=p["".concat(s,".").concat(d)]||p[d]||m[d]||i;return r?n.createElement(f,l(l({ref:t},u),{},{components:r})):n.createElement(f,l({ref:t},u))}));function f(e,t){var r=arguments,a=t&&t.mdxType;if("string"==typeof e||a){var i=r.length,l=new Array(i);l[0]=d;var o={};for(var s in t)hasOwnProperty.call(t,s)&&(o[s]=t[s]);o.originalType=e,o[p]="string"==typeof e?e:a,l[1]=o;for(var c=2;c<i;c++)l[c]=r[c];return n.createElement.apply(null,l)}return n.createElement.apply(null,r)}d.displayName="MDXCreateElement"},2534:(e,t,r)=>{r.r(t),r.d(t,{assets:()=>T,contentTitle:()=>v,default:()=>E,frontMatter:()=>N,metadata:()=>b,toc:()=>O});var n=r(7462),a=r(7294),i=r(3905),l=r(6010),o=r(2802),s=r(9960),c=r(3919),u=r(5999);const p={cardContainer:"cardContainer_fWXF",cardTitle:"cardTitle_rnsV",cardDescription:"cardDescription_PWke"};function m(e){let{href:t,children:r}=e;return a.createElement(s.Z,{href:t,className:(0,l.Z)("card padding--lg",p.cardContainer)},r)}function d(e){let{href:t,icon:r,title:n,description:i}=e;return a.createElement(m,{href:t},a.createElement("h2",{className:(0,l.Z)("text--truncate",p.cardTitle),title:n},r," ",n),i&&a.createElement("p",{className:(0,l.Z)("text--truncate",p.cardDescription),title:i},i))}function f(e){let{item:t}=e;const r=(0,o.Wl)(t);return r?a.createElement(d,{href:r,icon:"\ud83d\uddc3\ufe0f",title:t.label,description:t.description??(0,u.I)({message:"{count} items",id:"theme.docs.DocCard.categoryDescription",description:"The default description for a category card in the generated index about how many items this category includes"},{count:t.items.length})}):null}function h(e){let{item:t}=e;const r=(0,c.Z)(t.href)?"\ud83d\udcc4\ufe0f":"\ud83d\udd17",n=(0,o.xz)(t.docId??void 0);return a.createElement(d,{href:t.href,icon:r,title:t.label,description:t.description??n?.description})}function g(e){let{item:t}=e;switch(t.type){case"link":return a.createElement(h,{item:t});case"category":return a.createElement(f,{item:t});default:throw new Error(`unknown item type ${JSON.stringify(t)}`)}}function k(e){let{className:t}=e;const r=(0,o.jA)();return a.createElement(y,{items:r.items,className:t})}function y(e){const{items:t,className:r}=e;if(!t)return a.createElement(k,e);const n=(0,o.MN)(t);return a.createElement("section",{className:(0,l.Z)("row",r)},n.map(((e,t)=>a.createElement("article",{key:t,className:"col col--6 margin-bottom--lg"},a.createElement(g,{item:e})))))}const N={sidebar_position:1},v="\ud83d\udcbb Machine Learning Tutorial Series",b={unversionedId:"tutorials/index",id:"tutorials/index",title:"\ud83d\udcbb Machine Learning Tutorial Series",description:"Welcome to season 4 (2023-24) of the beginner machine learning tutorial series of the UCL Artificial Intelligence Society!",source:"@site/our-initiatives/tutorials/index.mdx",sourceDirName:"tutorials",slug:"/tutorials/",permalink:"/our-initiatives/tutorials/",draft:!1,tags:[],version:"current",sidebarPosition:1,frontMatter:{sidebar_position:1},sidebar:"docsSidebar",previous:{title:"Our Initiatives",permalink:"/our-initiatives/"},next:{title:"0: Introduction to AI",permalink:"/our-initiatives/tutorials/intro-to-ai"}},T={},O=[{value:"Our Team",id:"our-team",level:2},{value:"DOXA Challenges",id:"doxa-challenges",level:2},{value:"Weekly Tutorials",id:"weekly-tutorials",level:2},{value:"Timeline",id:"timeline",level:2},{value:"Term 1",id:"term-1",level:3},{value:"Term 2",id:"term-2",level:3},{value:"Previous Seasons",id:"previous-seasons",level:2}],w={toc:O},x="wrapper";function E(e){let{components:t,...r}=e;return(0,i.kt)(x,(0,n.Z)({},w,r,{components:t,mdxType:"MDXLayout"}),(0,i.kt)("h1",{id:"-machine-learning-tutorial-series"},"\ud83d\udcbb Machine Learning Tutorial Series"),(0,i.kt)("p",null,"Welcome to season 4 (2023-24) of the beginner machine learning tutorial series of the UCL Artificial Intelligence Society!"),(0,i.kt)("p",null,"If you have any questions about our content or machine learning more generally, feel free to ask us at the next session or make a forum post on the ",(0,i.kt)("a",{parentName:"p",href:"https://discord.gg/KSUZuQx?ltclid=3f704b3b-9044-415a-a2d7-e41007214187"},"UCLAIS Discord server"),"."),(0,i.kt)("h2",{id:"our-team"},"Our Team"),(0,i.kt)("p",null,"This academic year, the tutorial series is being delivered by the following people:"),(0,i.kt)("ul",null,(0,i.kt)("li",{parentName:"ul"},(0,i.kt)("a",{parentName:"li",href:"#"},"Angela Yu")," (Head of Tutorials)"),(0,i.kt)("li",{parentName:"ul"},(0,i.kt)("a",{parentName:"li",href:"#"},"Damien Bose")," (ML Officer)"),(0,i.kt)("li",{parentName:"ul"},(0,i.kt)("a",{parentName:"li",href:"#"},"Suhail Merali")," (ML Officer)"),(0,i.kt)("li",{parentName:"ul"},(0,i.kt)("a",{parentName:"li",href:"#"},"Arham Ali")," (Tutorials Reviewer)")),(0,i.kt)("h2",{id:"doxa-challenges"},"DOXA Challenges"),(0,i.kt)("p",null,"Our teaching will be supplemented by engaging AI competitions on ",(0,i.kt)("a",{parentName:"p",href:"https://doxaai.com/"},"DOXA")," related to topics such as visual computing, natural language processing and reinforcement learning."),(0,i.kt)("p",null,"To take part and follow along with the tutorial series content, ",(0,i.kt)("a",{parentName:"p",href:"https://doxaai.com/sign-up"},"sign up")," to the platform if you have not done so already."),(0,i.kt)("h2",{id:"weekly-tutorials"},"Weekly Tutorials"),(0,i.kt)("p",null,"\ud83d\udcda Access our notebooks and slides here!"),(0,i.kt)(y,{mdxType:"DocCardList"}),(0,i.kt)("h2",{id:"timeline"},"Timeline"),(0,i.kt)("h3",{id:"term-1"},"Term 1"),(0,i.kt)("p",null,"During the first half term, we aim to cover basic concepts of ",(0,i.kt)("strong",{parentName:"p"},"classical ML"),":"),(0,i.kt)("ul",null,(0,i.kt)("li",{parentName:"ul"},"Tutorial 0: ",(0,i.kt)("strong",{parentName:"li"},"Introduction to AI")),(0,i.kt)("li",{parentName:"ul"},"Tutorial 1: ",(0,i.kt)("strong",{parentName:"li"},"Introduction to Python")),(0,i.kt)("li",{parentName:"ul"},"Tutorial 2: ",(0,i.kt)("strong",{parentName:"li"},"Regression")),(0,i.kt)("li",{parentName:"ul"},"Tutorial 3: ",(0,i.kt)("strong",{parentName:"li"},"Classification"))),(0,i.kt)("p",null,"After reading week, we will focus on ",(0,i.kt)("strong",{parentName:"p"},"Deep Learning"),"!"),(0,i.kt)("ul",null,(0,i.kt)("li",{parentName:"ul"},"Tutorial 4: ",(0,i.kt)("strong",{parentName:"li"},"Neural Networks")),(0,i.kt)("li",{parentName:"ul"},"Tutorial 5: ",(0,i.kt)("strong",{parentName:"li"},"Visual Computing I")),(0,i.kt)("li",{parentName:"ul"},"Tutorial 6: ",(0,i.kt)("strong",{parentName:"li"},"Visual Computing II")),(0,i.kt)("li",{parentName:"ul"},"Tutorial 7: ",(0,i.kt)("strong",{parentName:"li"},"Recurrent Neural Networks")),(0,i.kt)("li",{parentName:"ul"},"Tutorial 8: ",(0,i.kt)("strong",{parentName:"li"},"ML Pipeline In Practice"))),(0,i.kt)("h3",{id:"term-2"},"Term 2"),(0,i.kt)("p",null,"We will explore ",(0,i.kt)("strong",{parentName:"p"},"Natural Language Processing")," and ",(0,i.kt)("strong",{parentName:"p"},"Reinforcement Learning")," - more information on this later!"),(0,i.kt)("h2",{id:"previous-seasons"},"Previous Seasons"),(0,i.kt)("p",null,"The content and resources from previous years are available on GitHub:"),(0,i.kt)("ul",null,(0,i.kt)("li",{parentName:"ul"},(0,i.kt)("a",{parentName:"li",href:"https://github.com/UCLAIS/Machine-Learning-Tutorials"},"Season 1 (2020/21)")," ","\u2013"," led by ",(0,i.kt)("a",{parentName:"li",href:"https://github.com/kimdanny"},"Danny Toeun Kim")),(0,i.kt)("li",{parentName:"ul"},(0,i.kt)("a",{parentName:"li",href:"https://github.com/UCLAIS/ML-Tutorials-Season-2"},"Season 2 (2021/22)")," ","\u2013"," led by ",(0,i.kt)("a",{parentName:"li",href:"https://github.com/MartynasPocius"},"Martynas Pocius")),(0,i.kt)("li",{parentName:"ul"},(0,i.kt)("a",{parentName:"li",href:"https://github.com/UCLAIS/ml-tutorials-season-3"},"Season 3 (2022/23)")," ","\u2013"," led by ",(0,i.kt)("a",{parentName:"li",href:"https://trhlikfilip.com/"},"Filip Trhl\xedk"))))}E.isMDXComponent=!0}}]);