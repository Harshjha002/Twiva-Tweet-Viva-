import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { User } from "../models/user.model.js";
import {
    uploadOnCloudinary,
    deleteFromCloudinary,
} from "../utils/cloudinary.js";
import { ApiResponse } from "../utils/ApiResponse.js";

const registerUser = asyncHandler(async (req, res) => {
    const { fullname, email, username, password } = req.body;

    // Check for required fields
    if ([fullname, email, username, password].some((field) => !field?.trim())) {
        throw new ApiError(400, "All fields are required");
    }

    // Check if user already exists
    const existedUser = await User.findOne({
        $or: [{ username }, { email }],
    });

    if (existedUser) {
        throw new ApiError(409, "User with email or username already exists");
    }

    const avatarLocalPath = req.files?.avatar?.[0]?.path;
    const coverImageLocalPath = req.files?.coverImage?.[0]?.path;

    if (!avatarLocalPath) {
        throw new ApiError(400, "Avatar file is missing");
    }

    let avatar, coverImage;

    // Upload avatar
    try {
        avatar = await uploadOnCloudinary(avatarLocalPath);
        console.log("Uploaded avatar", avatar);
    } catch (error) {
        console.log("Error uploading avatar");
        throw new ApiError(500, "Failed to upload avatar");
    }

    // Upload cover image
    try {
        if (coverImageLocalPath) {
            coverImage = await uploadOnCloudinary(coverImageLocalPath);
            console.log("Uploaded cover image", coverImage);
        }
    } catch (error) {
        console.log("Error uploading cover image");
        throw new ApiError(500, "Failed to upload cover image");
    }

    // Create user in the database
    try {
        const user = await User.create({
            fullname,
            email,
            username: username.toLowerCase(),
            avatar: avatar.url,
            coverImage: coverImage?.url || "",
            password,
        });

        const createdUser = await User.findById(user._id).select(
            "-password -refreshToken"
        );

        if (!createdUser) {
            throw new ApiError(500, "Something went wrong");
        }

        return res
            .status(201)
            .json(
                new ApiResponse(
                    201,
                    createdUser,
                    "User registered successfully"
                )
            );
    } catch (error) {
        console.log("Error creating user:", error);

        if (avatar) {
            await deleteFromCloudinary(avatar.public_id);
        }
        if (coverImage) {
            await deleteFromCloudinary(coverImage.public_id);
        }
        throw new ApiError(500, "Failed to register user");
    }
});

export { registerUser };
