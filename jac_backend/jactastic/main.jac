# user_logic.jac

node user_profile {
    has name: str = "";
    has location: str = "";
    has allergens: list = [];
    has dietary_preferences: list = [];
}

walker create_or_update_user {
    has name: str;
    has location: str;
    has allergens: list;
    has dietary_preferences: list;

    can setup with `root entry {
        
        print("Received new user data from Expo: " + self.name);

        user = user_profile(
            name = self.name,
            location = self.location,
            allergens = self.allergens,
            dietary_preferences = self.dietary_preferences
        );
        
        here ++> user;

        
        return {
            "status": "success", 
            "msg": "User " + self.name + " saved successfully in Jac 2.x!"
        };
    }
}


walker get_user {
    has name: str;

    can fetch_user with `root entry {
        print("Looking for user: " + self.name);
        for i in [-->] {
            if i.name == self.name {
                return {
                    "status": "success",
                    "data": {
                        "name": i.name,
                        "location": i.location,
                        "allergens": i.allergens,
                        "dietary_preferences": i.dietary_preferences
                    }
                };
            }
        }

        return {
            "status": "error",
            "msg": "User not found"
        };
    }
}