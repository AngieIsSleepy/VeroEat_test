node user_profile {
    has name: str = "";
    has location: str = "";
    has allergens: list = [];
    has dietary_preferences: list = [];
}

walker create_or_update_user {
    has name: str = "";
    has location: str = "";
    has allergens: list = [];
    has dietary_preferences: list = [];

    has response_data: dict = {};

    can setup with entry {
        try {
            print("Received user data from Expo: " + str(self.name));

            for i in [-->] {
                if hasattr(i, 'name') and i.name == self.name {
                    print("Updating existing user: " + str(self.name));
                    i.location = self.location;
                    i.allergens = self.allergens;
                    i.dietary_preferences = self.dietary_preferences;
                    
                    self.response_data = {
                        "status": "success", 
                        "msg": "User updated successfully!"
                    };
                    return;
                }
            }
            
            print("Creating new user: " + str(self.name));
            user = user_profile(
                name = self.name,
                location = self.location,
                allergens = self.allergens,
                dietary_preferences = self.dietary_preferences
            );
            
            here ++> user;

            self.response_data = {
                "status": "success", 
                "msg": "User created successfully!"
            };
            return;
        } except Exception as e {
            print("CRASHED: " + str(e));
            self.response_data = {
                "status": "error",
                "msg": "Backend Error: " + str(e)
            };
            return;
        }
    }
}

walker get_user {
    has name: str = "";
    
    has response_data: dict = {};

    can fetch_user with entry {
        try {
            print("Looking for user: " + str(self.name));
            for i in [-->] {
                if hasattr(i, 'name') and i.name == self.name {
                    self.response_data = {
                        "status": "success",
                        "data": {
                            "name": i.name,
                            "location": i.location,
                            "allergens": i.allergens,
                            "dietary_preferences": i.dietary_preferences
                        }
                    };
                    return;
                }
            }

            self.response_data = {
                "status": "error",
                "msg": "User not found"
            };
            return;
        } except Exception as e {
            self.response_data = {
                "status": "error",
                "msg": "Backend Error: " + str(e)
            };
            return;
        }
    }
}

walker root {
    can start with entry {
        print("Jac API Server Running 🚀");
    }
}