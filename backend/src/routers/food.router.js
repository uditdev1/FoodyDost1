import {Router} from "express";
import { sample_foods, sample_tags } from "../data.js";
import {SearchHistory} from "../models/searchHistory.model.js";
import mongoose from "mongoose";
import { foodModel } from "../models/food.model.js";
import handler from "express-async-handler";
import admin from '../middleware/admin.mid.js';
import { userModel } from "../models/user.model.js";

const router = Router();

const removeDuplicatesById = (foods) => {
  const seen = new Set();
  return foods.filter((food) => {
      if (seen.has(food._id.toString())) return false;
      seen.add(food._id.toString());
      return true;
  });
};

router.get("/", async (req, res) => {
  try {
      const userId = req.query.id; 
      const allFoods = await foodModel.find({});

      if (!userId) {
          return res.send(allFoods);
      }
      const recommendedItems = await getRecommendations(userId);

      let sortedFoods = [];
      const notRecommendedFoods = [];
      recommendedItems.forEach((item) => {
          const foodsWithItem = allFoods.filter((food) =>
              food.name.toLowerCase().includes(item.toLowerCase())
          );
          sortedFoods.push(...foodsWithItem);
      });
      allFoods.forEach((food) => {
          if (
              !recommendedItems.some((item) =>
                  food.name.toLowerCase().includes(item.toLowerCase())
              )
          ) {
              notRecommendedFoods.push(food);
          }
      });
      sortedFoods.push(...notRecommendedFoods);
      sortedFoods = removeDuplicatesById(sortedFoods);
      res.send(sortedFoods);
  } catch (error) {
      console.error("Error fetching food data:", error);
      res.status(500).send({ error: "Error fetching food data." });
  }
});

router.get("/favourites", handler (async (req, res) => {
  const {userId , foodId} = req.query;
  const user = await userModel.findById(userId);
  let isFavourite = false;
  if(user.favourite_food){
    isFavourite = user.favourite_food.includes(foodId);
  }
  res.status(200).json({
    success : true,
    data : isFavourite
  })
}));

router.post("/favourites", handler (async (req, res) => {
  const {userId , foodId} = req.body;
  const foodProduct = await userModel.findByIdAndUpdate(
    {_id : userId},
    {
      $push : {
        favourite_food : foodId
      }
    },
    {new : true}
  );
  res.status(200).json({
    success : true,
    data : foodProduct
  })
}));

router.delete("/favourites", handler (async (req, res) => {
  const {userId , foodId} = req.query;
  const foodProduct = await userModel.findByIdAndUpdate(
    {_id : userId},
    {
      $pull : {
        favourite_food : foodId
      }
    },
    {new : true}
  );
  res.status(200).json({
    success : true,
    data : foodProduct
  })

}));

router.post("/review", handler (async (req, res) => {
  const {id , comment , rating, email, name} = req.body;
  const foodProduct = await foodModel.findByIdAndUpdate(
    {_id : id},
    {
      $push : {
        reviews : {comment , rating, email, name}
      }
    },
    {new : true}
  );
  const updatedFood = await foodModel.findByIdAndUpdate(
    {_id : id},
    {
      $set : {
        rating : foodProduct.averageRating
      }
    },
    {new : true}
  );
  res.status(200).json({
    success : true,
    message : "Upload Success",
    data : updatedFood
  })
}));

router.delete("/review", handler (async (req, res) => {
  const {reviewId , foodId} = req.query;
  const foodProduct = await foodModel.findByIdAndUpdate(
    {_id : foodId}, 
    {
      $pull : {
        reviews : {_id : reviewId}
      }
    },
    {new : true}
  );
  const updatedFood = await foodModel.findByIdAndUpdate(
    {_id : foodId},
    {
      $set : {
        rating : foodProduct.averageRating
      }
    },
    {new : true}
  );
  res.status(200).json({
    success : true,
    message : "Data fetched success",
    data : updatedFood
  });
}));


router.get("/reviews/:id", handler (async (req, res) => {
  const {id} = req.params;
  const foodProduct = await foodModel.findById({_id : id});
  res.status(200).json({
    success : true,
    message : "Data fetched success",
    data : foodProduct.reviews
  });
}));

router.post(
  '/',
  admin,
  handler(async (req, res) => {
    const { name, price, tags, favorite, imageUrl, origins, cookTime } =
      req.body;
    const food = new foodModel({
      name,
      price,
      tags: tags.split ? tags.split(',') : tags,
      favorite,
      imageUrl,
      origins: origins.split ? origins.split(',') : origins,
      cookTime,
    });

    await food.save();

    res.send(food);
  })
);


router.put(
  '/',
  admin,
  handler(async (req, res) => {
    const { id, name, price, tags, favorite, imageUrl, origins, cookTime } =
      req.body;

    await foodModel.updateOne(
      { _id: id },
      {
        name,
        price,
        tags: tags.split ? tags.split(',') : tags,
        favorite,
        imageUrl,
        origins: origins.split ? origins.split(',') : origins,
        cookTime,
      }
    );

    res.send();
  })
);
router.delete(
  '/:foodId',
  admin,
  handler(async (req, res) => {
    const { foodId } = req.params;
    await foodModel.deleteOne({ _id: foodId });
    res.send();
  })
);

router.get("/search/:searchTerm", handler ( async (req,res) => {
    const searchTerm = req.params.searchTerm;
    const searchRegex = new RegExp(searchTerm , 'i');
    const foods = await foodModel.find({name : {$regex : searchRegex }});
    res.send(foods);
}));

router.post('/saveSearch', async (req, res) => {
  const { id, term } = req.body;
  const newSearch = new SearchHistory({ userId: id, searchTerm: term });
  try {
    const searchCount = await SearchHistory.countDocuments({ userId: id });
    if (searchCount >= 5) {
      const oldestSearch = await SearchHistory.findOneAndDelete({ userId: id }, { sort: { timestamp: 1 } });
    }
    await newSearch.save();
    res.status(201).json({ message: 'Search saved' });
  } catch (error) {
    res.status(500).json({ error: 'Error saving search' });
  }
});

router.post('/removeSearch', async (req, res) => {
  const { id, term } = req.body;
  try {
    await SearchHistory.findOneAndDelete({usrId : id , searchTerm : term});
    res.status(201).json({ message: 'Search removed' });
  } catch (error) {
    res.status(500).json({ error: 'Error removing search' });
  }
});


const getRecommendations = async (userId) => {
  try {
    const searches = await SearchHistory.aggregate([
      { $match: { userId: new mongoose.Types.ObjectId(userId) } },
      { $group: { _id: '$searchTerm', count: { $sum: 1 }, lastSearchedAt: { $last: '$timestamp' } } },
      { $sort: { lastSearchedAt: -1, count: -1 } }, // Sort by last searched time and then by count
      { $limit: 4 }
    ]);
    const recommendedItems = searches.map(search => search._id);
    return recommendedItems;
  } catch (error) {
    console.error(error);
    return [];
  }
};
  
router.get('/recommendations/:userId', async (req, res) => {
  const { userId } = req.params;
  try {
    const recommendations = await getRecommendations(userId);
    res.status(200).json(recommendations);
  } catch (error) {
    res.status(500).json({ error: 'Error fetching recommendations' });
  }
});

router.get("/tags/getAll", handler (async (req, res) => {
    const userId = req.query.id; 
    const tags = await foodModel.aggregate([
        {
            $unwind : '$tags' ,
        },
        {
            $group : {
                _id : '$tags',
                count : {$sum : 1} ,
            },
        },
        {
            $project : {
                _id : 0,
                name : "$_id",
                count : "$count",
            }
        }
    ]).sort({count : -1 }); // -1 for descending and 1 is for ascending 
    
    if(userId){
      const foodIds = await userModel.findById({_id : userId});
      if(!foodIds.favourite_food) {
        return res.send(ans);
      }
      tags.unshift({name : "favourites" , count : foodIds.favourite_food.length });
    }

    res.send(tags);
}));

router.get("/tags/:tag",handler( async (req, res) => {
    const {tag} = req.params;
    const foods = await foodModel.find({tags : tag});
    res.send(foods);
}));

router.get("/tags/favourites/:userId", handler (async (req, res) => {
  const {userId} = req.params;
  const foodIds = (await userModel.findById({_id : userId})).favourite_food;
  const foods = await foodModel.find({ _id: { $in: foodIds } });
  res.send(foods);
}));

router.get("/:id",handler( async (req, res) => {
    const {id} = req.params;
    const food = await foodModel.findById(id);
    res.send(food);
}));

export default router;