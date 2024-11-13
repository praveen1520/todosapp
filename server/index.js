const express=require("express")
const cors=require("cors")
const path=require("path")
const {open}=require("sqlite")
const sqlite3=require("sqlite3")
const {v4:uuidv4}=require("uuid")
const bcrypt=require("bcrypt")
const jsonweb=require("jsonwebtoken")
const { error } = require("console")
const dbpath=path.join(__dirname,"Tododata.db")
const app=express()
const jsonMiddleware=express.json()
app.use(jsonMiddleware);
let db=null
app.use(cors())
const intializeandserve=async ()=>{
    try{
        db=await open({
            filename: dbpath,
            driver: sqlite3.Database,
        })
        app.listen(3523,()=>{
            console.log("server started at localhost//30000")
        })
        await createTables()
        await insertinginformation()
    }catch(e){
        console.log(`db error:${e.message}`)
    }
}

intializeandserve()
const createTables=async ()=>{
    try{
        await db.run(`CREATE TABLE IF NOT EXISTS user (id INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,username TEXT,password TEXT)`)
        await db.run(`CREATE TABLE IF NOT EXISTS task (id TEXT PRIMARY KEY,userId INT,title TEXT,description TEXT,date DATE,status TEXT DEFAULT pending,FOREIGN KEY (userId) REFERENCES user(id))`)
    }catch(e){
        console.log(e.message)
    }
}
app.use(express.json())
const insertinginformation=async ()=>{
    const task1=uuidv4()
    try{
        const usersCount = await db.get("SELECT COUNT(*) as count FROM user");
        if(usersCount===0){
            await db.run(`INSERT INTO user (username,password) VALUES ("praveen","praveen2024")`);
            await db.run(`INSERT INTO user (username,password) VALUES ("pravee","praveen202")`);
        }
        const taskcount=await db.get("SELECT COUNT(*) as count FROM user");
        if(taskcount===0){
            await db.run(`INSERT INTO task (id,userId,title,description,date,status)VALUES(?,1,"Learn CSS","Learning CSS gives to beautify the web page",2024-11-13,"pending")`,[task1])
        }
        
    }catch(e){
        console.log(e.message)
    }
}

app.post("/register",async(request,response)=>{
    const {username,password}=request.body
    console.log(password)
    const hashedpassword=await bcrypt.hash(password,10)
    const sqlquery=await db.get(`SELECT * FROM user WHERE username='${username}';`)
    if(sqlquery!==undefined){
        response.send("UserName is already existed")
        console.log("user name already exists")
    }else{
        const query=`INSERT INTO user (username,password) VALUES ('${username}','${hashedpassword}')`
        const resp=await db.run(query)
        const newId=resp.lastID
        response.send("user Registered successfully")
    }
})

app.post("/login",async(request,response)=>{
    const {username,password}=request.body
    const query=`SELECT * FROM user WHERE username='${username}'`;
    const userquery=await db.get(query)
    if(userquery===undefined){
        response.send("Invaild username")
        response.status(400)
    }
    else{
         try {
            const comparepass = await bcrypt.compare(password, userquery.password);
            if (comparepass === true) {
                const idt = userquery.id;
                const payload = {
                    username: username,
                    userid: idt
                };
                const jwtToken = jsonweb.sign(payload, "USERLOGIN");
                response.send({
                    jwt_token: jwtToken
                });
            } else {
                response.status(400).send("Invalid Password");
            }
        } catch (error) {
            response.status(500).send("Error comparing passwords");
            console.error(error);
        }
    }
})

const Authentication=(request,response,next)=>{
    let jwtToken;
    const authHeader=request.headers["authorization"]
    if (authHeader!==undefined){
        jwtToken=authHeader.split(" ")[1]
    }
    if(jwtToken===undefined){
        response.send("No valid Token")
    }else{
        jsonweb.verify(jwtToken,"USERLOGIN",(error,payload)=>{
            if(error){
                response.send("INvalid jwtToken")
            }else{
                request.userId=payload.userid
                console.log("User ID from JWT payload:", request.userId); // Log to confirm it's set
                next()
            }
        })
    }
}

app.get("/tasks",Authentication,async(request,response)=>{
    const userId=request.userId
    const query=`SELECT * FROM task where userId='${userId}'`
    const sqlexc=await db.all(query)
    console.log(sqlexc)
    response.send(sqlexc)
})

app.post("/addtask",Authentication,async(request,response)=>{
    const taskdetails=request.body
    const {title,description,date,status}=taskdetails
    const taskid=uuidv4()
    const userId=request.userId
    console.log(userId)
    const query=`INSERT INTO task (id,userId,title,description,date,status)VALUES(
    '${taskid}','${userId}','${title}','${description}','${date}','${status}')`;
    const runquer=await db.run(query)
    response.send("Task Updated SuccessFully")

    
})

app.put("/updatetask/:id",Authentication,async(request,response)=>{
    const taskdetails=request.body
    const taskid=request.params
    const {title,description,date,status}=taskdetails
    const userId=request.userId
    const query=`UPDATE task SET title=?,description=?,date=?,status=? WHERE id=? AND userId=?`
    const res=await db.run(query,[title,description,date,status,taskid,userId])
    if (res.changes===0){
        response.send("Task is not found ")
    }else{
        response.send("Task updated successfully")
    }
})

app.delete('/deletetask/:id', async (req, res) => {
  try {
    const taskId = req.params.id;
    if (!taskId) {
      return res.status(400).send({ message: "Task ID is required" });
    }

    const task = await db.get("SELECT * FROM task WHERE id = ?", [taskId]);
    if (!task) {
      return res.status(404).send({ message: "Task not found" });
    }

    await db.run("DELETE FROM task WHERE id = ?", [taskId]);
    res.status(200).send({ message: "Task deleted successfully" });
  } catch (error) {
    console.error("Error occurred:", error);
    res.status(500).send({ message: "Internal Server Error" });
  }
});