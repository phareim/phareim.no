<template>
  <div class="poem">
    <h1 v-html="randomPoem"></h1>
  </div>
</template>

<script>
export default {
  data() {
    return {
      poems: [
        'this is<br>a terrible<br>poem',
        'yet another bad<br>poem',
        'roses are red<br>violets are blue<br>sugar is sweet<br>and so are you',
        'twinkle twinkle<br>little star<br>how I wonder<br>what you are',
        'a short verse<br>of nonsense<br>that makes<br>no sense',
        'why did I<br>write this<br>poem<br>no one knows',
        'in the dark<br>of the night<br>this poem<br>has no light',
        'falling leaves<br>crunchy steps<br>poetry so bad<br>everyone weeps',
        'cats and dogs<br>rain and fog<br>random words<br>in a blog',
        'sunset glow<br>winds that blow<br>words that don’t<br>really flow',
        'bumpy roads<br>heavy loads<br>this poem<br>quickly erodes',
        'moon so bright<br>starry night<br>rhymes that lack<br>any bite',
        'coffee cup<br>fill it up<br>writing poems<br>what’s the pup',
        'silly goose<br>on the loose<br>writing poems<br>is a ruse',
        'big blue sky<br>wonder why<br>this poem<br>makes me sigh',
        'hungry bear<br>empty lair<br>poetry<br>isn’t fair',
        'broken rhyme<br>out of time<br>this poem<br>is a crime',
        'chilly breeze<br>autumn leaves<br>bad poems<br>no one needs',
        'reading this<br>is quite a miss<br>poetry<br>gone amiss',
        'mountain tall<br>waterfall<br>bad poems<br>beat them all',
        'toaster burns<br>life’s turns<br>writing bad<br>poems learns',
        'raindrops fall<br>standing tall<br>poems that<br>make no call',
        'lazy days<br>hazy ways<br>bad poems<br>never pays',
        'city lights<br>endless nights<br>poetry<br>lacks the heights',
        'this is yet<br>another<br>bad poem<br>for you',
        'writing words<br>flying birds<br>poetry<br>that hurts',
        'lost my way<br>in the fray<br>this poem<br>won’t stay',
        'sugar sweet<br>under feet<br>writing bad<br>poems neat',
        'empty page<br>thoughts engage<br>bad poetry<br>on stage'
      ],
      randomPoem: '',
    };
  },
  mounted() {
    this.randomPoem = this.getRandomPoem();
  },
  methods: {
    getRandomPoem() {
      const randomIndex = Math.floor(Math.random() * this.poems.length);
      return this.poems[randomIndex];
    },
  },
};
</script>

<style>
  /* ... dine stiler ... */
</style>