const express = require('express');
const cors = require('cors');
const client = require('./client.js');
const app = express();
const morgan = require('morgan');
const ensureAuth = require('./auth/ensure-auth');
const createAuthRoutes = require('./auth/create-auth-routes');
const request = require('superagent');

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(morgan('dev')); // http logging


const authRoutes = createAuthRoutes();

// setup authentication routes to give user an auth token
// creates a /auth/signin and a /auth/signup POST route. 
// each requires a POST body with a .email and a .password
app.use('/auth', authRoutes);

// everything that starts with "/api" below here requires an auth token!
app.use('/api', ensureAuth);

// and now every request that has a token in the Authorization header will have a `req.userId` property for us to see who's talking
app.get('/api/test', (req, res) => {
  res.json({
    message: `in this proctected route, we get the user's id like so: ${req.userId}`
  });
});
// tested API in postman
// https://api.themoviedb.org/3/search/movie/?api_key=a46b378e406b255bcb52df07d587a8b2&query=rambo

app.get('/movies', async (req, res) => {
  try {
    const search = req.query.search;

    const movieData = await request.get(`https://api.themoviedb.org/3/search/movie?api_key=${process.env.MOVIE_DB_KEY}&query=${search}`);

    res.json(movieData.body);
  } catch (e) {

    res.status(500).json({ error: e.message });
  }
});

app.get('/api/favorites', async (req, res) => {
  try {
    const data = await client.query('SELECT * from movies WHERE owner_id=$1',
      [
        req.userId
      ]);

    res.json(data.rows);
  } catch (e) {

    res.status(500).json({ error: e.message });
  }
});


// use req.body for POST/PUT requests.
// expect the client to supply an object in the POST body.
// on the client side, this will look like .send(somePostBodyObject)
app.post('/api/favorites', async (req, res) => {
  try {
    const data = await client.query(`INSERT INTO movies 
    (title, popularity, release_date, poster, movie_api_id, owner_id)
    VALUES ($1, $2, $3, $4, $5, $6)
    RETURNING *
    `,
      [
        req.body.title,
        req.body.popularity,
        req.body.release_date,
        req.body.poster,
        req.body.movie_api_id,
        req.userId
      ]);

    res.json(data.rows);
  } catch (e) {

    res.status(500).json({ error: e.message });
  }
});

// req.params is used because the variable is located in the URL.
// the client will hit this API with /DELETE /favorites/4
// because 4 lives in the URL, it is a req.params thing
app.delete('/api/favorites/:id', async (req, res) => {
  try {
    // use param id to update completed boolean
    const id = req.params.id;
    const data = await client.query(`DELETE from movies 
    WHERE id = $1 and owner_id = $2
    `,
      [
        id,
        req.userId,
      ]);

    res.json(data.rows);
  } catch (e) {

    res.status(500).json({ error: e.message });
  }
});

app.use(require('./middleware/error'));

module.exports = app;
