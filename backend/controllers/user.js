const Post = require("../models/Post");
const User = require("../models/User");
const {sendEmail} = require("../middlewares/sendEmail");
const crypto = require("crypto");
const cloudinary = require("cloudinary");

exports.register = async (req, res) => {
    try {
        const {name, email, password, avatar} = req.body;
        let user = await User.findOne({email});
        if(user)
        {
            return res.status(400).json({
                success: false,
                message: "User already exists."
            });
        }

        const myCloud = await cloudinary.v2.uploader.upload(avatar, {
            folder: "avatars",
          });

        user = await User.create({
            name, 
            email, 
            password, 
            avatar: {public_id: myCloud.public_id, url: myCloud.secure_url}
        });

        let token = await user.generateToken();

        const options = {
            expires: new Date(Date.now() + 90*24*60*60*1000),
            httpOnly: true
        };

       res.status(201).cookie("token", token, options).json({
            success: true,
            user,
            token,
        });
    } 
    catch (error) {
        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
}

exports.login = async (req, res) => {

    try 
    {
        const {email, password} = req.body;
        let user = await User.findOne({email}).select("+password")
        .populate("posts followers following");

        if(!user)
        {
            return res.status(400).json({
                success: false,
                message: "User does not exists."
            });
        }
        const isMatch = await user.matchPassword(password);
        if(!isMatch)
        {
            return res.status(400).json({
                success: false,
                message: "Incorrect password"
            });
        }
        
        let token = await user.generateToken();

        const options = {
            expires: new Date(Date.now() + 90*24*60*60*1000),
            httpOnly: true
        };

        res.status(200).cookie("token", token, options).json({
            success: true,
            user,
            token,
        });
    } 
    catch (error) 
    {
        
    }
}

exports.logout = async (req, res) => {

     try 
     {
        res.status(200).cookie("token", null, {expires: new Date(Date.now()), httpOnly: true}).json({
            success: true,
            message: "Logged out."
        });
     } 
     catch (error) 
     {
        res.status(500).json({
            success: true,
            message: error.message
        });
     }
}

exports.followUser = async (req, res) => {
    
    try 
    {
        const userToFollow = await User.findById(req.params.id);
        const loggedInUser = await User.findById(req.user._id);

        if(!userToFollow)
        {
            return res.status(404).json({
                success: false,
                message: "user not found."
            });
        }
        
        if(loggedInUser.following.includes(userToFollow._id))
        {
            const indexFollowing = loggedInUser.following.indexOf(userToFollow._id);
            const indexFollower = userToFollow.followers.indexOf(loggedInUser._id);

            loggedInUser.following.splice(indexFollowing, 1);
            userToFollow.followers.splice(indexFollower, 1);
            await loggedInUser.save();
            await userToFollow.save();

            res.status(200).json({
                success: true,
                message: "User unfollowed."
            });
        }
        else
        {
            loggedInUser.following.push(userToFollow._id);
            userToFollow.followers.push(loggedInUser._id);
            await loggedInUser.save();
            await userToFollow.save();

            res.status(200).json({
                success: true,
                message: "User followed."
            });
        }
    } 
    catch (error) 
    {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
}

exports.updatePassword = async (req, res) => {

    try 
    {
        const user = await User.findById(req.user._id).select("+password");
        const {oldPassword, newPassword} = req.body;
        if(!oldPassword || !newPassword)
        {
            return res.status(400).json({
                success: false,
                message: "Please provide both old and new passwords."
            });
        }
        const isMatch = await user.matchPassword(oldPassword);
        if(!isMatch)
        {
            return res.status(400).json({
                success: false,
                message: "please enter correct password."
            });
        }
        user.password = newPassword;
        await user.save();

        res.status(200).json({
            success: true,
            message: "password updated."
        });
    } 
    catch (error) 
    {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
}

exports.updateProfile = async (req, res) => {

    try 
    {
        const user = await User.findById(req.user._id);
        const {name, email, avatar} = req.body;
        if(name)
        {
            user.name = name;
        }
        if(email)
        {
            user.email = email;
        }
        if(avatar)
        {
            await cloudinary.v2.uploader.destroy(user.avatar.public_id);
            const myCloud = await cloudinary.v2.uploader.upload(avatar, {folder: "avatars"});

            user.avatar.public_id = myCloud.public_id;
            user.avatar.url = myCloud.secure_url;
        }
        await user.save();

        res.status(200).json({
            success: true,
            message: "Profile updated."
        });
    } 
    catch (error) 
    {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
}

exports.deleteProfile = async (req, res) => {

    try
    {
        const user = await User.findById(req.user._id);
        const posts = user.posts;
        const followers = user.followers;
        const following = user.following;
        const userId = user._id;

        // Removing Avatar from cloudinary
        await cloudinary.v2.uploader.destroy(user.avatar.public_id);
        await User.findByIdAndDelete(req.user._id);

        //logout the user
        res.cookie("token", null, {expires: new Date(Date.now()), httpOnly: true});

        //deleting all the user's posts
        for(let i=0; i<posts.length; i++)
        {
            const post = await Post.findById(posts[i]);
            await cloudinary.v2.uploader.destroy(post.image.public_id);
            await Post.findByIdAndDelete(posts[i]);
        }

        //deleting the user if form follower's following list
        for(let i=0; i<followers.length; i++)
        {
            const follower = await User.findById(followers[i]);
            const index = await follower.following.indexOf(userId);
            follower.following.splice(index, 1);

            await follower.save();
        }
        
        //deleting the user following followers
        for(let i=0; i<followers.length; i++)
        {
            const follows = await User.findById(following[i]);
            const index = await follows.followers.indexOf(userId);
            follows.followers.splice(index, 1);

            await follows.save();
        }
        res.status(200).json({
            success: true,
            message: "Profile deleted."
        });
    } 
    catch (error) 
    {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
}

exports.myProfile = async (req, res) => {
    
    try 
    {
        const user = await User.findById(req.user._id).populate("posts followers following");
        
        res.status(200).json({
            success: true,
            user
        });
    } 
    catch (error) 
    {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
}

exports.getUserProfile = async (req, res) => {

    try 
    {
        const user = await User.findById(req.params.id).populate("posts followers following");
        if(!user)
        {
            return res.status(404).json({
                success: false,
                message: "User not found"
            });
        }

        res.status(200).json({
            success: true,
            user
        });
    } 
    catch (error) 
    {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
}

exports.getAllUsers = async (req, res) => {

    try 
    {
        const users = await User.find({});
        
        res.status(200).json({
            success: true,
            users
        });
    } 
    catch (error) 
    {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
}

exports.forgotPassword = async (req, res) => {
    try {
      const user = await User.findOne({ email: req.body.email });
  
      if (!user) {
        return res.status(404).json({
          success: false,
          message: "User not found",
        });
      }
  
      const resetPasswordToken = user.getResetPasswordToken();
  
      await user.save();
  
      const resetUrl = `${req.protocol}://${req.get(
        "host"
      )}/password/reset/${resetPasswordToken}`;
  
      const message = `Reset Your Password by clicking on the link below: \n\n ${resetUrl}`;
  
      try {
        await sendEmail({
          email: user.email,
          subject: "Reset Password",
          message,
        });
  
        res.status(200).json({
          success: true,
          message: `Email sent to ${user.email}`,
        });
      } catch (error) {
        user.resetPasswordToken = undefined;
        user.resetPasswordExpire = undefined;
        await user.save();
  
        res.status(500).json({
          success: false,
          message: error.message,
        });
      }
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message,
      });
    }
  };
  
exports.resetPassword = async (req, res) => {

    try 
    {
        const resetPasswordToken = crypto.createHash("sha256").update(req.params.token).digest("hex");

        const user = await User.findOne({
            resetPasswordToken,
            resetPasswordExpires: { $gt : Date.now() }
        });

        if(!user)
        {
            return res.status(401).json({
                success: false,
                message: "Token is invalid or has expired."
            });
        }

        user.password = req.body.password;
        user.resetPasswordToken = undefined;
        user.resetPasswordExpires = undefined;

        await user.save();
        res.status(200).json({
            success: true,
            message: "Password updated."
        });
    } 
    catch (error) 
    {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
}


exports.getMyPosts = async (req, res) => {

    try 
    {
        const user = await User.findById(req.user._id);

        const posts = [];

        for(let i=0; i<user.posts.length; i++)
        {
            const post = await Post.findById(user.posts[i]).populate("likes comments.user owner");
            posts.push(post);
        }
    
        res.status(200).json({
            success: true,
            posts 
        });
    } 
    catch (error) 
    {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
}