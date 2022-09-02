const express = require('express');

const { setTokenCookie, requireAuth, restoreUser } = require('../../utils/auth');
const { Spot, User, Booking, Review, SpotImage, ReviewImage, sequelize } = require('../../db/models');
const { check } = require('express-validator');
const { handleValidationErrors } = require('../../utils/validation');

const router = express.Router();

const { Op } = require('sequelize');


//-------------------------------------------------------------------
//-------------------------------------------------------------------
const validSpot = [
  check('address')
    .exists({ checkFalsy: true })
    .notEmpty()
    .isLength({ min: 1 })
    .withMessage('Street address is required'),
  check('city')
    .exists({ checkFalsy: true })
    .notEmpty()
    .isLength({ min: 1 })
    .withMessage('City is required'),
  check('state')
    .exists({ checkFalsy: true })
    .notEmpty()
    .isLength({ min: 1 })
    .withMessage('State is required'),
  check('country')
    .exists({ checkFalsy: true })
    .notEmpty()
    .isLength({ min: 1 })
    .withMessage('Country is required'),
  check('lat')
    .exists({ checkFalsy: true })
    .notEmpty()
    .isFloat({ min: -90, max: 90 })
    .withMessage('Latitude is not valid'),
  check('lng')
    .exists({ checkFalsy: true })
    .notEmpty()
    .isFloat({ min: -180, max: 180 })
    .withMessage('Longitude is not valid'),
  check('name')
    .exists({ checkFalsy: true })
    .notEmpty()
    .isLength({ min: 1, max: 50 })
    .withMessage('Name must be less than 50 characters'),
  check('description')
    .exists({ checkFalsy: true })
    .notEmpty()
    .isLength({ min: 1 })
    .withMessage('Description is required'),
  check('price')
    .exists({ checkFalsy: true })
    .notEmpty()
    .withMessage('Price per day is required'),
  handleValidationErrors
]
//-------------------------------------------------------------------
//-------------------------------------------------------------------


// Get all spots
// id, ownerId, address, city, state, country, lat, lng, name, description, price, createdAt, updatedAt, >>>previewImage, and >>>avgRating
router.get('/', async (req, res) => {
  let { size, page } = req.query

  if (!page) page = 1
  if (!size) size = 20

  page = parseInt(page);
  size = parseInt(size);

  const pagination = {}

  if (page >= 1 && size >= 1) {
    pagination.limit = size
    pagination.offset = size * (page - 1)

  }

  //get an ARRAY of current user's owned spots
  const allSpots = await Spot.findAll({
    ...pagination
  })

})

// // // get all spots
// // // eager loading (doesn't work)

// router.get("/", async (req, res) => {
//   const allSpots = await Spot.findAll({
//     include: [
//       { model: Review, attributes: [] },
//       { model: SpotImage }
//     ],
//     attributes: {
//       include: [
//         [sequelize.fn("AVG", sequelize.col("stars")), "avgRating"],
//       ]
//     },
//     raw: true
//   })

//   let spotList = []

//   allSpots.forEach(spot => {
//     spotList.push(spot.toJSON())
//   })

//   spotList.forEach(spot => {
//     spot.SpotImages.forEach(image => {
//       if (image.preview === true) {
//         spot.previewImage = image.url
//       }
//     })
//     if (!spot.SpotImages) {
//       spot.previewImage = "no image"
//     }
//     delete spot.SpotImages
//   })

//   return res.json(spotList)
// })



//create a spot
//id, ownerId, address, city, state, country, lat, lng, name, description, price, createdAt, and updatedAt
router.post('/', [validSpot, requireAuth], async (req, res) => {

  const { address, city, state, country,
    lat, lng, name, description, price } = req.body

  // Body validation error 400
  let createSpot

  try {
    const createSpot = await Spot.create({
      ownerId: req.user.id,
      address,
      city,
      state,
      country,
      lat,
      lng,
      name,
      description,
      price
    })
  } catch (error) {
    res.status(400)
    return res.json({
      "message": "Validation Error",
      "statusCode": 400,
      "errors": {
        "address": "Street address is required",
        "city": "City is required",
        "state": "State is required",
        "country": "Country is required",
        "lat": "Latitude is not valid",
        "lng": "Longitude is not valid",
        "name": "Name must be less than 50 characters",
        "description": "Description is required",
        "price": "Price per day is required"
      }
    })
  }

  res.status(201)
  res.json(createSpot)
});




// Get all Spots owned by the Current User
router.get('/current', requireAuth, async (req, res) => {
  //requireAuth ensures (req.user) -- if no current logged in user, err-->err handling
  const currentUser = req.user

  //get an ARRAY of current user's owned spots
  const currentSpots = await Spot.findAll({
    where: {
      ownerId: currentUser.id
    }
  })

  let spotsInfo = []

  for (let spot of currentSpots) {
    //avgRating
    const rating = await Review.findAll({
      where: { spotId: spot.id },
      attributes: [
        [sequelize.fn("AVG", sequelize.col("stars")), "avgRating"]
      ]
    })

    //previewImage
    const preview = await SpotImage.findAll({
      where: {
        spotId: spot.id,
        preview: true
      },
      attributes: [
        ["url", "previewImage"]
      ],
      limit: 1
    })

    // spot.dataValues.avgRating = rating
    // spot.dataValues.previewImage = preview

    data = {
      ...spot.dataValues,
      avgRating: rating[0].avgRating,
      previewImage: preview[0].previewImage
    }

    spotsInfo.push(data)
  }

  return res.json({
    Spots: spotsInfo
  })
})


// Get details of a Spot from an id
// id, ownerId, address, city, state, country, lat, lng, name, description, price, createdAt, and updatedAt
//"numReviews", "avgStarRating", "SpotImages", "Owner"

router.get("/:spotId", async (req, res) => {
  const { spotId } = req.params

  const spotById = await Spot.findByPk(spotId, {
    include: [
      { model: SpotImage, attributes: ["id", "url", "preview"] },
      { model: User, attributes: ["id", "firstName", "lastName"] }
    ]
  })

  if (!spotById) {
    res.status(404)
    return res.json({
      "message": "Spot couldn't be found",
      "statusCode": 404
    })
  } else {
    const numReviews = await Review.count({ where: { spotId } })
    const avgRating = await Review.findAll({
      where: { spotId },
      attributes: [[sequelize.fn("AVG", sequelize.col("stars")), "avgStarRating"]]
    })
  }



})












// Create a Spot
// Creates and returns a new spot.

//  An authenticated user is required for a successful response
//  New spot exists in the database after request
//  Spot data returned includes the id, ownerId, address, city, state, country, lat, lng, name, description, price, createdAt, and updatedAt
//  Error response with status 400 is given when body validations for the address, city, state, country, lat, lng, name, description, or price are violated
router.post("/")



module.exports = router;
