"use strict";(self.webpackChunkucl_artificial_intelligence_society=self.webpackChunkucl_artificial_intelligence_society||[]).push([[7247],{3905:(e,t,r)=>{r.d(t,{Zo:()=>u,kt:()=>g});var n=r(7294);function a(e,t,r){return t in e?Object.defineProperty(e,t,{value:r,enumerable:!0,configurable:!0,writable:!0}):e[t]=r,e}function o(e,t){var r=Object.keys(e);if(Object.getOwnPropertySymbols){var n=Object.getOwnPropertySymbols(e);t&&(n=n.filter((function(t){return Object.getOwnPropertyDescriptor(e,t).enumerable}))),r.push.apply(r,n)}return r}function i(e){for(var t=1;t<arguments.length;t++){var r=null!=arguments[t]?arguments[t]:{};t%2?o(Object(r),!0).forEach((function(t){a(e,t,r[t])})):Object.getOwnPropertyDescriptors?Object.defineProperties(e,Object.getOwnPropertyDescriptors(r)):o(Object(r)).forEach((function(t){Object.defineProperty(e,t,Object.getOwnPropertyDescriptor(r,t))}))}return e}function s(e,t){if(null==e)return{};var r,n,a=function(e,t){if(null==e)return{};var r,n,a={},o=Object.keys(e);for(n=0;n<o.length;n++)r=o[n],t.indexOf(r)>=0||(a[r]=e[r]);return a}(e,t);if(Object.getOwnPropertySymbols){var o=Object.getOwnPropertySymbols(e);for(n=0;n<o.length;n++)r=o[n],t.indexOf(r)>=0||Object.prototype.propertyIsEnumerable.call(e,r)&&(a[r]=e[r])}return a}var l=n.createContext({}),c=function(e){var t=n.useContext(l),r=t;return e&&(r="function"==typeof e?e(t):i(i({},t),e)),r},u=function(e){var t=c(e.components);return n.createElement(l.Provider,{value:t},e.children)},p="mdxType",m={inlineCode:"code",wrapper:function(e){var t=e.children;return n.createElement(n.Fragment,{},t)}},d=n.forwardRef((function(e,t){var r=e.components,a=e.mdxType,o=e.originalType,l=e.parentName,u=s(e,["components","mdxType","originalType","parentName"]),p=c(r),d=a,g=p["".concat(l,".").concat(d)]||p[d]||m[d]||o;return r?n.createElement(g,i(i({ref:t},u),{},{components:r})):n.createElement(g,i({ref:t},u))}));function g(e,t){var r=arguments,a=t&&t.mdxType;if("string"==typeof e||a){var o=r.length,i=new Array(o);i[0]=d;var s={};for(var l in t)hasOwnProperty.call(t,l)&&(s[l]=t[l]);s.originalType=e,s[p]="string"==typeof e?e:a,i[1]=s;for(var c=2;c<o;c++)i[c]=r[c];return n.createElement.apply(null,i)}return n.createElement.apply(null,r)}d.displayName="MDXCreateElement"},250:(e,t,r)=>{r.r(t),r.d(t,{assets:()=>l,contentTitle:()=>i,default:()=>m,frontMatter:()=>o,metadata:()=>s,toc:()=>c});var n=r(7462),a=(r(7294),r(3905));const o={sidebar_position:9},i="7: Generative Visual Computing",s={unversionedId:"tutorials/2024-2025/visual-computing-2",id:"tutorials/2024-2025/visual-computing-2",title:"7: Generative Visual Computing",description:"Date: 27th November 2024",source:"@site/our-initiatives/tutorials/2024-2025/visual-computing-2.md",sourceDirName:"tutorials/2024-2025",slug:"/tutorials/2024-2025/visual-computing-2",permalink:"/our-initiatives/tutorials/2024-2025/visual-computing-2",draft:!1,tags:[],version:"current",sidebarPosition:9,frontMatter:{sidebar_position:9},sidebar:"docsSidebar",previous:{title:"6: Visual Computing I",permalink:"/our-initiatives/tutorials/2024-2025/visual-computing-1"},next:{title:"8: Recurrent Neural Networks",permalink:"/our-initiatives/tutorials/2024-2025/rnns"}},l={},c=[],u={toc:c},p="wrapper";function m(e){let{components:t,...r}=e;return(0,a.kt)(p,(0,n.Z)({},u,r,{components:t,mdxType:"MDXLayout"}),(0,a.kt)("h1",{id:"7-generative-visual-computing"},"7: Generative Visual Computing"),(0,a.kt)("p",null,(0,a.kt)("strong",{parentName:"p"},"Date: 27th November 2024")),(0,a.kt)("p",null,"\ud83d\udca1 This week, we'll dive into the exciting world of generative models for computer vision! We'll explore how to create models that can learn the intrinsic features of a dataset and generate new images. We'll focus on building an ",(0,a.kt)("strong",{parentName:"p"},"auto-encoder"),", a powerful tool for capturing the essence of visual data in a compressed ",(0,a.kt)("strong",{parentName:"p"},"latent space"),"."),(0,a.kt)("p",null,"A latent space is a lower-dimensional representation that encodes the most important features of the data. By learning this compact representation, generative models can create new images that resemble the original dataset. We'll introduce you to various state-of-the-art models used in industry and research, such as ",(0,a.kt)("strong",{parentName:"p"},"Variational Auto-Encoders")," (VAEs), ",(0,a.kt)("strong",{parentName:"p"},"Generative Adversarial Networks")," (GANs) and ",(0,a.kt)("strong",{parentName:"p"},"Diffussion Models"),"!\ud83d\udca1"),(0,a.kt)("p",null,"Also, I want to remind you guys that we are running a ",(0,a.kt)("a",{parentName:"p",href:"https://doxaai.com/competition/cifar-10"},(0,a.kt)("strong",{parentName:"a"},"DOXA challenge"))," and which you can get prizes for!"),(0,a.kt)("p",null,"\u2022\u2060  \u2060\u20601st place will get a Mystery prize \ud83c\udf6b + AI Society Shirt \ud83d\udc55+ Pen\ud83d\udd8a\ufe0f\n\u2022\u2060  \u2060\u20602nd place will receive AI Society Shirt \ud83d\udc55 + Pen. \ud83d\udd8a\ufe0f(",(0,a.kt)("strong",{parentName:"p"},"NOTE")," that 1st and 2nd place have to achieve a score greater than 0.8074)\n\u2022\u2060  \u2060\u2060\u2060The remaining participants will receive UCL AI Society Pens as long as you can get a score above Jeremy (0.6077)"),(0,a.kt)("p",null,"The deadline for submission is Wednesday, December 4th, 5:59PM which is right before our next session on RNNs."),(0,a.kt)("p",null,"For more information on how to do better in the challenge access the last 10 slides and watch our tutorial recording below."),(0,a.kt)("p",null,"You can access our ",(0,a.kt)("strong",{parentName:"p"},"slides")," here: \ud83d\udcbb ",(0,a.kt)("a",{parentName:"p",href:"https://www.canva.com/design/DAGSEDAKiHs/jRkDsMJRc65jzSe0KgmbYg/view?utm_content=DAGSEDAKiHs&utm_campaign=designshare&utm_medium=link&utm_source=editor"},(0,a.kt)("strong",{parentName:"a"},"Tutorial 7 Slides"))),(0,a.kt)("p",null,"The ",(0,a.kt)("strong",{parentName:"p"},"recording")," from this session is available here: \ud83c\udfa4 ",(0,a.kt)("a",{parentName:"p",href:"https://youtu.be/5ceoctSndC0"},(0,a.kt)("strong",{parentName:"a"},"Tutorial 7 Recording"))),(0,a.kt)("p",null,"We did not go through the ",(0,a.kt)("strong",{parentName:"p"},"demonstration notebook")," during session, but you can access our it here: \ud83d\udcd8 ",(0,a.kt)("a",{parentName:"p",href:"https://github.com/UCLAIS/ml-tutorials-season-5/blob/main/week-7/VAE_andAE.ipynb"},(0,a.kt)("strong",{parentName:"a"},"Tutorial 7 Notebook"))))}m.isMDXComponent=!0}}]);