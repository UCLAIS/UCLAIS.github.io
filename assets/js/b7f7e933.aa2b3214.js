"use strict";(self.webpackChunkucl_artificial_intelligence_society=self.webpackChunkucl_artificial_intelligence_society||[]).push([[232],{3905:(e,t,r)=>{r.d(t,{Zo:()=>p,kt:()=>d});var n=r(7294);function a(e,t,r){return t in e?Object.defineProperty(e,t,{value:r,enumerable:!0,configurable:!0,writable:!0}):e[t]=r,e}function o(e,t){var r=Object.keys(e);if(Object.getOwnPropertySymbols){var n=Object.getOwnPropertySymbols(e);t&&(n=n.filter((function(t){return Object.getOwnPropertyDescriptor(e,t).enumerable}))),r.push.apply(r,n)}return r}function i(e){for(var t=1;t<arguments.length;t++){var r=null!=arguments[t]?arguments[t]:{};t%2?o(Object(r),!0).forEach((function(t){a(e,t,r[t])})):Object.getOwnPropertyDescriptors?Object.defineProperties(e,Object.getOwnPropertyDescriptors(r)):o(Object(r)).forEach((function(t){Object.defineProperty(e,t,Object.getOwnPropertyDescriptor(r,t))}))}return e}function s(e,t){if(null==e)return{};var r,n,a=function(e,t){if(null==e)return{};var r,n,a={},o=Object.keys(e);for(n=0;n<o.length;n++)r=o[n],t.indexOf(r)>=0||(a[r]=e[r]);return a}(e,t);if(Object.getOwnPropertySymbols){var o=Object.getOwnPropertySymbols(e);for(n=0;n<o.length;n++)r=o[n],t.indexOf(r)>=0||Object.prototype.propertyIsEnumerable.call(e,r)&&(a[r]=e[r])}return a}var l=n.createContext({}),u=function(e){var t=n.useContext(l),r=t;return e&&(r="function"==typeof e?e(t):i(i({},t),e)),r},p=function(e){var t=u(e.components);return n.createElement(l.Provider,{value:t},e.children)},c="mdxType",m={inlineCode:"code",wrapper:function(e){var t=e.children;return n.createElement(n.Fragment,{},t)}},g=n.forwardRef((function(e,t){var r=e.components,a=e.mdxType,o=e.originalType,l=e.parentName,p=s(e,["components","mdxType","originalType","parentName"]),c=u(r),g=a,d=c["".concat(l,".").concat(g)]||c[g]||m[g]||o;return r?n.createElement(d,i(i({ref:t},p),{},{components:r})):n.createElement(d,i({ref:t},p))}));function d(e,t){var r=arguments,a=t&&t.mdxType;if("string"==typeof e||a){var o=r.length,i=new Array(o);i[0]=g;var s={};for(var l in t)hasOwnProperty.call(t,l)&&(s[l]=t[l]);s.originalType=e,s[c]="string"==typeof e?e:a,i[1]=s;for(var u=2;u<o;u++)i[u]=r[u];return n.createElement.apply(null,i)}return n.createElement.apply(null,r)}g.displayName="MDXCreateElement"},3444:(e,t,r)=>{r.r(t),r.d(t,{assets:()=>l,contentTitle:()=>i,default:()=>m,frontMatter:()=>o,metadata:()=>s,toc:()=>u});var n=r(7462),a=(r(7294),r(3905));const o={sidebar_position:8},i="6: Visual Computing II",s={unversionedId:"tutorials/visual-computing-2",id:"tutorials/visual-computing-2",title:"6: Visual Computing II",description:"Date: 29th November 2023",source:"@site/our-initiatives/tutorials/visual-computing-2.md",sourceDirName:"tutorials",slug:"/tutorials/visual-computing-2",permalink:"/our-initiatives/tutorials/visual-computing-2",draft:!1,tags:[],version:"current",sidebarPosition:8,frontMatter:{sidebar_position:8},sidebar:"docsSidebar",previous:{title:"5: Visual Computing I",permalink:"/our-initiatives/tutorials/visual-computing-1"},next:{title:"7: Recurrent Neural Networks",permalink:"/our-initiatives/tutorials/rnns"}},l={},u=[],p={toc:u},c="wrapper";function m(e){let{components:t,...r}=e;return(0,a.kt)(c,(0,n.Z)({},p,r,{components:t,mdxType:"MDXLayout"}),(0,a.kt)("h1",{id:"6-visual-computing-ii"},"6: Visual Computing II"),(0,a.kt)("p",null,(0,a.kt)("strong",{parentName:"p"},"Date: 29th November 2023")),(0,a.kt)("p",null,"\ud83d\udca1 This week we\u2019ll be expanding on last weeks session so see how we can turn our classifiers in ",(0,a.kt)("strong",{parentName:"p"},"generative models"),"! Generative models have recently captured a lot of attention, with models like ",(0,a.kt)("strong",{parentName:"p"},"DALL-E")," generating art of users and ",(0,a.kt)("strong",{parentName:"p"},"ChatGPT")," generating informative responses to many questions. Our focus will be on generative models for ",(0,a.kt)("strong",{parentName:"p"},"computer vision"),", where we\u2019ll explore how to ",(0,a.kt)("strong",{parentName:"p"},"build a model")," that will learn the intrinsic ",(0,a.kt)("strong",{parentName:"p"},"features of a dataset")," and ",(0,a.kt)("strong",{parentName:"p"},"generate new images"),". We\u2019ll walk you through how to build your own ",(0,a.kt)("strong",{parentName:"p"},"auto-encoder")," and share with you many newer models that have been used in industry and research alike. \ud83d\udca1"),(0,a.kt)("p",null,"You can access our ",(0,a.kt)("strong",{parentName:"p"},"demonstration notebook")," here: \ud83d\udcd8 ",(0,a.kt)("a",{parentName:"p",href:"https://github.com/UCLAIS/ml-tutorials-season-4/blob/main/week-6/VAE_andAE.ipynb"},(0,a.kt)("strong",{parentName:"a"},"Tutorial 6 Notebook"))),(0,a.kt)("p",null,"You can access our ",(0,a.kt)("strong",{parentName:"p"},"slides")," here: \ud83d\udcbb ",(0,a.kt)("a",{parentName:"p",href:"https://www.canva.com/design/DAFqI69GK8k/gqvVWbxKazyxAg2Sx3Fbng/edit?utm_content=DAFqI69GK8k&utm_campaign=designshare&utm_medium=link2&utm_source=sharebutton"},(0,a.kt)("strong",{parentName:"a"},"Tutorial 6 Slides"))),(0,a.kt)("p",null,"The ",(0,a.kt)("strong",{parentName:"p"},"recording")," from this session is available here: \ud83c\udfa4 ",(0,a.kt)("a",{parentName:"p",href:"https://youtu.be/sJwf4R3jh8g"},(0,a.kt)("strong",{parentName:"a"},"Tutorial 6 Recording"))))}m.isMDXComponent=!0}}]);