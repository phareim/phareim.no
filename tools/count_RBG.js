
let r = (Math.random()> 0.5? 80 + Math.random()*20 : 200 + Math.random()*20);
let g = (Math.random()> 0.5? 100 + Math.random()*20 : 190 + Math.random()*20);
let b = (Math.random()> 0.5? 90 + Math.random()*20 : 280 + Math.random()*20);
let total = [];
let sum = 0;
for (let i = 0; i < 10; i++) {
    r = (Math.random()> 0.5? 80 + Math.random()*20 : 200 + Math.random()*20);
    g = (Math.random()> 0.5? 100 + Math.random()*20 : 190 + Math.random()*20);
    b = (Math.random()> 0.5? 90 + Math.random()*20 : 280 + Math.random()*20);
    sum = r + g + b;
    console.log(sum);
    total.push( sum );
}
console.log("<420: " + total.filter((t) => t < 420).length);
console.log("420-550: " + total.filter((t) => t >= 420 && t < 550).length);
console.log("550<: " + total.filter((t) => t >= 550).length);