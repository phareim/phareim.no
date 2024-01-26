<template>
  <div class="home">
    <img class="profile-pic" src="https://media.licdn.com/dms/image/C5603AQFvIgKksv9i4g/profile-displayphoto-shrink_400_400/0/1662048611811?e=1711584000&v=beta&t=K37o_1J8QEB5oJyn93odTEAm9ZLhQr5rTD4Gkz7Fbq0" alt="Petter's Profile Picture">
    <h1>Petter Hareim</h1>
    <p class="blurb">father, husband, geek, all round good guy. Writer of code and builder of good things. Lead Developer at Haugaland Kraft.</p>
    <div class="social-links">
      <a href="https://www.linkedin.com/in/phareim/" target="_blank">LinkedIn</a>
      <a href="https://twitter.com/phareim" target="_blank">Twitter</a>
    </div>
  </div>
</template>

<script>
export default {
  name: 'Home',
}
</script>

<style scoped>
.home {
  text-align: center;
  margin-top: 50px;
  max-width: 600px; /* comfortable reading width */
  margin-left: auto;
  margin-right: auto;
}

.profile-pic {
  border-radius: 50%;
  width: 200px;
  height: 200px;
}

.social-links a {
  margin: 0 10px;
}
</style>