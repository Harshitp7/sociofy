const express = require("express");
const {register, 
    login, 
    followUser, 
    logout, 
    updatePassword, 
    updateProfile, 
    deleteProfile, 
    myProfile,
    getUserProfile,
    getAllUsers,
    forgotPassword,
    resetPassword,
    getMyPosts} = require("../controllers/user");
const { isAuthenticated } = require("../middlewares/auth");

const router = express.Router();

router.route("/register").post(register);

router.route("/login").post(login);

router.route("/follow/:id").get(isAuthenticated, followUser);

router.route("/logout").get(logout);

router.route("/update/password").put(isAuthenticated, updatePassword);
router.route("/update/profile").put(isAuthenticated, updateProfile);

router.route("/delete/me").delete(isAuthenticated, deleteProfile);
router.route("/me").get(isAuthenticated, myProfile);

router.route("/my/posts").get(isAuthenticated, getMyPosts);

router.route("/user/:id").get(isAuthenticated, getUserProfile);
router.route("/users").get(isAuthenticated, getAllUsers);

router.route("/forgot/password").post(isAuthenticated, forgotPassword);
router.route("/password/reset/:token").put(resetPassword);

module.exports = router;