
/**
 
  冀优邮

 */

let html = $response.body;

html = html.replace(/10:00:00|09:\d\d:\d\d/g, `00:00:00`);

//html = html.replace(/goodsType":\d/g, `goodsType":1`);

html = html.replace(/stock":\d+/g, `stock":7`);

if (html.includes('</head>')) {
  html = '<script src="https://unpkg.com/vconsole@3.14.6/dist/vconsole.min.js" ignore></script><script ignore>new VConsole()</script>' + html;
}


$done({ body: html});

