// user_logic.jac (Jaclang 2.x 语法)

// 1. 定义用户节点 (注意新版的类型声明语法)
node user_profile {
    has name: str = "";
    has location: str = "";
    has allergens: list = [];
    has dietary_preferences: list = [];
}

// 2. 定义 Walker，它会自动变成一个 API 接口
walker create_or_update_user {
    // 接收从 Expo 前端传过来的参数
    has name: str;
    has location: str;
    has allergens: list;
    has dietary_preferences: list;

    // 当请求到达 root (根节点) 时执行的逻辑
    can setup with `root entry {
        // 在后台打印一下，方便你在 VS Code 终端里看到请求进来了
        print("Received new user data from Expo: " + self.name);

        // 创建一个用户节点
        user = user_profile(
            name = self.name,
            location = self.location,
            allergens = self.allergens,
            dietary_preferences = self.dietary_preferences
        );
        
        // 将用户节点连接到图上
        here ++> user;

        // 🚨 【改动点】Jac 2.x 直接使用 return 返回给前端，不再使用 report
        return {
            "status": "success", 
            "msg": "User " + self.name + " saved successfully in Jac 2.x!"
        };
    }
}