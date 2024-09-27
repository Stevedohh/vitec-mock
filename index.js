// index.js

require('dotenv').config();
const express = require('express');
const { Sequelize, DataTypes } = require('sequelize');
const methodOverride = require('method-override');
const path = require('path');
const cors = require('cors'); // Added for API CORS support

const app = express();

// Middleware
app.use(cors()); // Enable CORS for API endpoints
app.use(express.json());
app.use(express.urlencoded({ extended: true })); // To parse form data
app.use(methodOverride('_method')); // To support PUT and DELETE from forms
app.use(express.static(path.join(__dirname, 'public'))); // Serve static files

// Set up EJS as the view engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Initialize Sequelize with SQLite
const sequelize = new Sequelize({
  dialect: 'sqlite',
  storage: process.env.DATABASE_URL || './database.sqlite',
});

// Define Models
const Newsletter = sequelize.define('Newsletter', {
  name: {
    type: DataTypes.STRING,
    allowNull: false,
  },
});

const Subscriber = sequelize.define('Subscriber', {
  name: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  email: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
  },
});

// Define Many-to-Many Relationship
Newsletter.belongsToMany(Subscriber, { through: 'NewsletterSubscribers' });
Subscriber.belongsToMany(Newsletter, { through: 'NewsletterSubscribers' });

// Sync Models
sequelize.sync();

// Routes

// Frontend Routes

// Home page - list newsletters
app.get('/', async (req, res) => {
  const newsletters = await Newsletter.findAll();
  res.render('index', { newsletters });
});

// Create a new newsletter via form
app.post('/newsletters', async (req, res) => {
  const { name } = req.body;
  await Newsletter.create({ name });
  res.redirect('/');
});

// Delete a newsletter via form
app.delete('/newsletters/:newsletterId', async (req, res) => {
  const { newsletterId } = req.params;
  const newsletter = await Newsletter.findByPk(newsletterId);
  if (newsletter) {
    await newsletter.setSubscribers([]); // Remove associations
    await newsletter.destroy();
  }
  res.redirect('/');
});

// View subscribers of a newsletter
app.get('/newsletters/:newsletterId', async (req, res) => {
  const { newsletterId } = req.params;
  const newsletter = await Newsletter.findByPk(newsletterId);
  if (!newsletter) {
    return res.status(404).send('Newsletter not found');
  }
  const subscribers = await newsletter.getSubscribers();
  res.render('subscribers', { newsletter, subscribers });
});

// Add a subscriber to a newsletter via form
app.post('/newsletters/:newsletterId/subscribers', async (req, res) => {
  const { newsletterId } = req.params;
  const { name, email } = req.body;

  const [subscriber] = await Subscriber.findOrCreate({
    where: { email },
    defaults: { name },
  });

  const newsletter = await Newsletter.findByPk(newsletterId);
  if (newsletter) {
    await newsletter.addSubscriber(subscriber);
  }
  res.redirect(`/newsletters/${newsletterId}`);
});

// Delete a subscriber via form
app.delete('/subscribers/:subscriberId', async (req, res) => {
  const { subscriberId } = req.params;
  const subscriber = await Subscriber.findByPk(subscriberId);
  if (subscriber) {
    await subscriber.setNewsletters([]); // Remove associations
    await subscriber.destroy();
  }
  res.redirect('back');
});

// API Endpoints

// Get all newsletters
app.get('/api/newsletters', async (req, res) => {
  const newsletters = await Newsletter.findAll();
  res.json(newsletters);
});

// Create a new newsletter
app.post('/api/newsletters', async (req, res) => {
  const { name } = req.body;
  try {
    const newsletter = await Newsletter.create({ name });
    res.status(201).json(newsletter);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Delete a newsletter
app.delete('/api/newsletters/:newsletterId', async (req, res) => {
  const { newsletterId } = req.params;
  const newsletter = await Newsletter.findByPk(newsletterId);
  if (!newsletter) {
    return res.status(404).json({ error: 'Newsletter not found' });
  }
  await newsletter.setSubscribers([]); // Remove associations
  await newsletter.destroy();
  res.status(204).send();
});

app.get('/api/newsletters/:newsletterId/subscribers', async (req, res) => {
  const { newsletterId } = req.params;
  const newsletter = await Newsletter.findByPk(newsletterId, {
    include: [{
      model: Subscriber,
      through: { attributes: [] }, // Exclude join table attributes
    }],
  });
  if (!newsletter) {
    return res.status(404).json({ error: 'Newsletter not found' });
  }
  res.json(newsletter.Subscribers);
});

// Add a subscriber to a newsletter
app.post('/api/newsletters/:newsletterId/subscribers', async (req, res) => {
  const { newsletterId } = req.params;
  const { name, email } = req.body;

  try {
    const [subscriber] = await Subscriber.findOrCreate({
      where: { email },
      defaults: { name },
    });

    const newsletter = await Newsletter.findByPk(newsletterId);
    if (!newsletter) {
      return res.status(404).json({ error: 'Newsletter not found' });
    }

    await newsletter.addSubscriber(subscriber);
    res.status(201).json(subscriber);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Get all subscribers
app.get('/api/subscribers', async (req, res) => {
  const subscribers = await Subscriber.findAll();
  res.json(subscribers);
});

// Create a new subscriber
app.post('/api/subscribers', async (req, res) => {
  const { name, email } = req.body;
  try {
    const subscriber = await Subscriber.create({ name, email });
    res.status(201).json(subscriber);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Delete a subscriber
app.delete('/api/subscribers/:subscriberId', async (req, res) => {
  const { subscriberId } = req.params;
  const subscriber = await Subscriber.findByPk(subscriberId);
  if (!subscriber) {
    return res.status(404).json({ error: 'Subscriber not found' });
  }
  await subscriber.setNewsletters([]); // Remove associations
  await subscriber.destroy();
  res.status(204).send();
});

// Get newsletters of a subscriber
app.get('/api/subscribers/:subscriberId/newsletters', async (req, res) => {
  const { subscriberId } = req.params;
  const subscriber = await Subscriber.findByPk(subscriberId, {
    include: Newsletter,
  });
  if (!subscriber) {
    return res.status(404).json({ error: 'Subscriber not found' });
  }
  res.json(subscriber.Newsletters);
});

// Start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server started on port ${PORT}`);
});
