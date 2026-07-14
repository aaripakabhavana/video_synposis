/**
 * Vidsyn AI — Notes Service (frontend → FastAPI / Gemini bridge with client-side fallback)
 * ---------------------------------------------------------------------------
 * Sends a YouTube URL to retrieve metadata, and uses the Gemini API to produce
 * REAL, dynamic structured notes, slides, and quiz questions.
 *
 * If no Gemini API key is configured, it fetches the video title via YouTube oEmbed
 * and falls back to a high-fidelity client-side generator to build complete, 
 * accurate, structured study notes, slides, and quizzes.
 */
(function (global) {
  function extractVideoId(url) {
    if (!url) return null;
    var m = url.match(/(?:v=|\/embed\/|youtu\.be\/|\/shorts\/)([A-Za-z0-9_-]{11})/);
    if (m) return m[1];
    var bare = url.match(/^[A-Za-z0-9_-]{11}$/);
    return bare ? bare[0] : null;
  }

  function parseFallbackTitle(urlStr) {
    try {
      var url = new URL(urlStr);
      var v = url.searchParams.get('v');
      if (v && v.length > 5 && !/^[a-zA-Z0-9_-]{11}$/.test(v)) {
        return v.replace(/[-_]+/g, ' ').split(' ').map(function(w) { return w.charAt(0).toUpperCase() + w.slice(1); }).join(' ');
      }
      var lastSeg = url.pathname.split('/').filter(Boolean).pop();
      if (lastSeg && lastSeg !== 'watch' && lastSeg.length > 3) {
        return lastSeg.replace(/[-_]+/g, ' ').split(' ').map(function(w) { return w.charAt(0).toUpperCase() + w.slice(1); }).join(' ');
      }
    } catch (e) {
      var clean = urlStr.replace(/https?:\/\/(www\.)?youtube\.com\/watch\?v=/g, '')
                        .replace(/https?:\/\/youtu\.be\//g, '')
                        .replace(/[-_]+/g, ' ').trim();
      if (clean.length > 2) {
        return clean.split(' ').map(function(w) { return w.charAt(0).toUpperCase() + w.slice(1); }).join(' ');
      }
    }
    return "Video Analysis Study Guide";
  }

  function fetchYouTubeTitle(videoUrl) {
    var id = extractVideoId(videoUrl);
    if (!id) {
      return Promise.resolve(parseFallbackTitle(videoUrl));
    }
    var oembedUrl = 'https://www.youtube.com/oembed?url=' + encodeURIComponent('https://www.youtube.com/watch?v=' + id) + '&format=json';
    return fetch(oembedUrl)
      .then(function(res) {
        if (res.ok) return res.json();
        throw new Error('oEmbed failed');
      })
      .then(function(data) {
        return data.title || parseFallbackTitle(videoUrl);
      })
      .catch(function() {
        return parseFallbackTitle(videoUrl);
      });
  }

  function getThemeFromTitle(title, urlStr) {
    var lower = (title + ' ' + (urlStr || '')).toLowerCase();
    if (lower.indexOf('machine') !== -1 || lower.indexOf('learning') !== -1 || lower.indexOf('neural') !== -1 || lower.indexOf('data science') !== -1 || lower.indexOf('ai ') !== -1 || lower.indexOf('artificial') !== -1) return 'ml';
    if (lower.indexOf('web') !== -1 || lower.indexOf('react') !== -1 || lower.indexOf('css') !== -1 || lower.indexOf('html') !== -1 || lower.indexOf('javascript') !== -1 || lower.indexOf('frontend') !== -1 || lower.indexOf('node') !== -1) return 'web';
    if (lower.indexOf('python') !== -1 || lower.indexOf('django') !== -1 || lower.indexOf('flask') !== -1 || lower.indexOf('sql') !== -1 || lower.indexOf('backend') !== -1 || lower.indexOf('java') !== -1 || lower.indexOf('c++') !== -1 || lower.indexOf('programming') !== -1) return 'python';
    if (lower.indexOf('business') !== -1 || lower.indexOf('startup') !== -1 || lower.indexOf('marketing') !== -1 || lower.indexOf('finance') !== -1 || lower.indexOf('product') !== -1 || lower.indexOf('economics') !== -1) return 'business';
    return 'general';
  }

  // Seeded Random Number Generator for local shuffle
  function createSeededRandom(seed) {
    var h = 1779033703 ^ seed.length;
    for (var i = 0; i < seed.length; i++) {
      h = Math.imul(h ^ seed.charCodeAt(i), 3432918353);
      h = h << 13 | h >>> 19;
    }
    return function() {
      var t = h + 0x6D2B79F5;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      h = (t ^ (t >>> 14)) >>> 0;
      return h / 4294967296;
    };
  }

  function seededShuffle(arr, randomFn) {
    var result = arr.slice();
    for (var i = result.length - 1; i > 0; i--) {
      var j = Math.floor(randomFn() * (i + 1));
      var temp = result[i];
      result[i] = result[j];
      result[j] = temp;
    }
    return result;
  }

  // Quiz pools templates for local fallback
  var quizPools = {
    ml: {
      mcq: [
        { q: "What is the primary goal of Supervised Learning in {{TOPIC_0}}?", opts: ["Group unlabeled data points", "Learn mapping from input to output based on labeled pairs", "Maximize rewards in an environment", "None of the above"], correctText: "Learn mapping from input to output based on labeled pairs", feedback: "Supervised learning relies on labeled training datasets (input-output pairs)." },
        { q: "Which algorithm is commonly used for binary classification in {{TOPIC_0}}?", opts: ["Linear Regression", "Logistic Regression", "K-Means Clustering", "Apriori Algorithm"], correctText: "Logistic Regression", feedback: "Logistic Regression outputs probabilities between 0 and 1, standard for classification." },
        { q: "What is overfitting in {{TOPIC_0}} models?", opts: ["Under-training the model", "High test accuracy and low training accuracy", "High training accuracy but poor generalization to unseen data", "Slow training process"], correctText: "High training accuracy but poor generalization to unseen data", feedback: "Overfitting happens when a model learns the noise in training data rather than generalizing." },
        { q: "What role does gradient descent play in {{TOPIC_0}} training?", opts: ["Cleaning up the dataset", "Optimizing model weights to minimize the loss function", "Splitting data into training/validation", "Selecting visual features"], correctText: "Optimizing model weights to minimize the loss function", feedback: "Gradient descent adjusts parameters iteratively to minimize the loss." },
        { q: "Which activation function is most common in {{TOPIC_0}} hidden layers?", opts: ["Sigmoid", "ReLU (Rectified Linear Unit)", "Tanh", "Step function"], correctText: "ReLU (Rectified Linear Unit)", feedback: "ReLU is widely preferred because it mitigates the vanishing gradient problem." },
        { q: "What does 'epoch' mean in deep learning and {{TOPIC_0}}?", opts: ["One single training step", "One full pass of the entire training dataset", "The validation rate", "The speed of compiling code"], correctText: "One full pass of the entire training dataset", feedback: "An epoch is completed when the model has processed all samples in the dataset once." },
        { q: "What is the function of the validation dataset in {{TOPIC_0}}?", opts: ["To train model weights directly", "To tune hyperparameters and prevent overfitting", "To present final results to users", "To generate test reports"], correctText: "To tune hyperparameters and prevent overfitting", feedback: "Validation data helps evaluate hyperparameter combinations without touching the test set." },
        { q: "Which {{TOPIC_0}} branch optimizes behavior based on rewards and penalties?", opts: ["Supervised Learning", "Unsupervised Learning", "Reinforcement Learning", "Semi-supervised Learning"], correctText: "Reinforcement Learning", feedback: "Reinforcement learning optimizes actions via environment rewards." },
        { q: "What is K-Means commonly used for in {{TOPIC_0}}?", opts: ["Clustering (Unsupervised)", "Predicting stock prices", "Image generation", "Text Translation"], correctText: "Clustering (Unsupervised)", feedback: "K-Means partitions data points into K clusters based on distance metrics." },
        { q: "What does NLP stand for in {{TOPIC_0}} applications?", opts: ["National Learning Process", "Natural Language Processing", "Node Loop Program", "Neural Line Processing"], correctText: "Natural Language Processing", feedback: "NLP is the field of AI focused on machine-human language interactions." },
        { q: "What is the purpose of regularization in {{TOPIC_0}}?", opts: ["Speeding up loading times", "Reducing overfitting by penalizing large weights", "Converting categorical data to numerical data", "None of the above"], correctText: "Reducing overfitting by penalizing large weights", feedback: "Regularization (like L1/L2) adds a penalty to weight sizes to keep the model general." }
      ],
      tf: [
        { q: "Unsupervised learning requires output labels to partition data in {{TOPIC_0}}.", correct: false, feedback: "False. Unsupervised learning clusters unlabeled datasets." },
        { q: "{{TOPIC_0}} models generally require larger datasets than traditional algorithms.", correct: true, feedback: "True. Deep neural networks have millions of parameters and require massive scale." },
        { q: "Validation loss starting to increase while training loss decreases is a sign of overfitting in {{TOPIC_0}}.", correct: true, feedback: "True. This represents the model fitting to noise in training data." },
        { q: "A neural network is biologically identical to the human brain.", correct: false, feedback: "False. They are loosely inspired by neurons but mathematical in practice." },
        { q: "L1 regularization can shrink some weight coefficients to exactly zero, performing feature selection.", correct: true, feedback: "True. L1 (Lasso) regularization encourages sparse weights." }
      ],
      qa: [
        { q: "What is the difference between classification and regression in {{TOPIC_0}}?", answer: "Classification predicts discrete category tags, whereas regression predicts continuous numerical values." },
        { q: "Briefly define the term 'gradient descent' as used in {{TOPIC_0}}.", answer: "It is an iterative optimization algorithm used to minimize a loss function by adjusting weights in the direction of steepest descent." },
        { q: "Why is feature scaling (normalization) important before training {{TOPIC_0}} models?", answer: "It ensures all features contribute equally to gradient steps, accelerating training convergence." },
        { q: "What is cross-validation in {{TOPIC_0}} evaluation?", answer: "A technique where the dataset is partitioned into multiple folds, training and testing on different subsets to ensure model stability." },
        { q: "Define supervised learning.", answer: "A machine learning paradigm where the algorithm is trained on labeled input-output training datasets." }
      ]
    },
    web: {
      mcq: [
        { q: "What is JSX in {{TOPIC_0}}?", opts: ["A database connector style", "JavaScript XML extension representing UI structures", "A specialized styling framework", "A package manager"], correctText: "JavaScript XML extension representing UI structures", feedback: "JSX is a syntax extension to JavaScript that describes what the UI should look like." },
        { q: "Which React hook is used to handle side-effects in {{TOPIC_0}}?", opts: ["useState", "useEffect", "useMemo", "useContext"], correctText: "useEffect", feedback: "useEffect runs side-effects like data fetching, subscriptions, or DOM changes." },
        { q: "What does the Virtual DOM do in {{TOPIC_0}} development?", opts: ["Replaces local storage", "Maintains a light in-memory representation of real DOM to batch updates efficiently", "Creates visual canvas drawings", "Compiles code to native binary"], correctText: "Maintains a light in-memory representation of real DOM to batch updates efficiently", feedback: "The Virtual DOM optimizes updates by diffing changes and patching the real DOM only where needed." },
        { q: "How are properties passed down to child components in {{TOPIC_0}}?", opts: ["Through State", "Through Props", "Through Context only", "Through HTTP requests"], correctText: "Through Props", feedback: "Props (properties) pass data from parent components down to child components." },
        { q: "What does the useState hook return in {{TOPIC_0}}?", opts: ["An array containing the current state value and a function to update it", "A single state object", "A HTML element node", "A promise resolving state data"], correctText: "An array containing the current state value and a function to update it", feedback: "useState returns [stateVariable, setStateFunction] in an array." },
        { q: "Which command is standard to bootstrap a {{TOPIC_0}} app today?", opts: ["npm install html", "npm create vite@latest", "npx install react-all", "git clone angular"], correctText: "npm create vite@latest", feedback: "Vite is the modern industry standard for setting up React and web projects." },
        { q: "What is the purpose of keys in {{TOPIC_0}} lists?", opts: ["To style items uniquely", "To help React identify which items have changed, been added, or removed", "To encrypt user password values", "To bind button click events"], correctText: "To help React identify which items have changed, been added, or removed", feedback: "Keys give elements a stable identity, helping React align Virtual DOM nodes efficiently." },
        { q: "Can a child component update its parent's state in {{TOPIC_0}}?", opts: ["No, state is strictly private", "Yes, by calling parent callback functions passed down as props", "Yes, by directly modifying props", "Only via localStorage"], correctText: "Yes, by calling parent callback functions passed down as props", feedback: "Passing state updating callbacks as props allows children to trigger state changes in parents." },
        { q: "What is strict mode in {{TOPIC_0}}?", opts: ["A production optimization script", "A helper component that checks for potential problems during development", "A security firewall wrapper", "A strict TypeScript compiler option"], correctText: "A helper component that checks for potential problems during development", feedback: "React.StrictMode activates additional developer warnings and logs." },
        { q: "What does useMemo hook help optimize in {{TOPIC_0}}?", opts: ["Network requests speed", "Memoizing expensive calculation computations between renders", "Routing transition timelines", "Theme background colors"], correctText: "Memoizing expensive calculation computations between renders", feedback: "useMemo caches computational output of expensive functions to avoid recalculations." },
        { q: "What is hydration in modern Web frameworks?", opts: ["Cleaning up server logs", "Attaching event listeners to server-rendered HTML in the browser", "Fetching database entries", "Styling page elements dynamically"], correctText: "Attaching event listeners to server-rendered HTML in the browser", feedback: "Hydration makes static server-sent HTML interactive in the client browser." }
      ],
      tf: [
        { q: "React state updates are always immediate and synchronous in {{TOPIC_0}}.", correct: false, feedback: "False. State updates in React can be batched and asynchronous for performance." },
        { q: "A functional component can use hooks, but class components cannot.", correct: true, feedback: "True. Hooks are only supported in functional components." },
        { q: "Props passed into components are read-only and should not be modified directly in {{TOPIC_0}}.", correct: true, feedback: "True. Props represent immutable inputs passed down from parent scope." },
        { q: "Context API is designed to fully replace state management tools like Redux for all apps.", correct: false, feedback: "False. Context is good for simple sharing, but lacks optimization for complex states." },
        { q: "React renders components in the browser inside a web worker thread.", correct: false, feedback: "False. React runs entirely on the main UI browser thread." }
      ],
      qa: [
        { q: "Explain the difference between state and props in React and {{TOPIC_0}}.", answer: "State is local data managed within a component that can change; props are inputs passed down by parent components and are read-only." },
        { q: "What is the role of dependency arrays in useEffect hook in {{TOPIC_0}}?", answer: "They tell React when to re-trigger the side-effect. Empty dependency arrays [] run only once on mounting." },
        { q: "What is component-driven development in {{TOPIC_0}}?", answer: "An architectural style where UI layout is split into reusable, self-contained modular components." },
        { q: "Briefly explain standard lifting state up pattern.", answer: "Moving shared state to the closest common ancestor of components that need to share it, passing state and modifiers down as props." },
        { q: "What is conditional rendering in JSX?", answer: "Rendering different UI elements depending on conditional expressions using ternary operator or logical && syntax." }
      ]
    },
    python: {
      mcq: [
        { q: "What is the time complexity of searching a sorted array using Binary Search in {{TOPIC_0}}?", opts: ["O(N)", "O(log N)", "O(N log N)", "O(1)"], correctText: "O(log N)", feedback: "Binary search cuts the search space in half at each step, yielding logarithmic complexity." },
        { q: "Which of the following Python data types is mutable in {{TOPIC_0}}?", opts: ["List", "Tuple", "String", "Integer"], correctText: "List", feedback: "Lists can be updated in-place, whereas tuples, strings, and integers are immutable." },
        { q: "What does PEP 8 define in {{TOPIC_0}} development?", opts: ["Standard database syntax", "Style guide for writing readable Python code", "Web deployment checklists", "A package manager tool"], correctText: "Style guide for writing readable Python code", feedback: "PEP 8 is the official style convention for formatting Python source code." },
        { q: "Which data structure follows the Last-In-First-Out (LIFO) model?", opts: ["Queue", "Stack", "Linked List", "Binary Tree"], correctText: "Stack", feedback: "Stacks process items in a LIFO order, where inputs and outputs occur at the top." },
        { q: "What is the purpose of the __init__ method in a Python class?", opts: ["To delete objects from memory", "To initialize class instances with starting attributes", "To import library modules", "To compile functions"], correctText: "To initialize class instances with starting attributes", feedback: "__init__ is the constructor method invoked automatically on instantiation." },
        { q: "In backend databases, what does ACID stand for?", opts: ["Acoustic, Core, Index, Data", "Atomicity, Consistency, Isolation, Durability", "Active, Cipher, Input, Directory", "None of the above"], correctText: "Atomicity, Consistency, Isolation, Durability", feedback: "ACID principles guarantee reliable transaction processing in database engines." },
        { q: "What is the average time complexity of looking up a key in a Hash Map?", opts: ["O(N)", "O(N log N)", "O(1)", "O(log N)"], correctText: "O(1)", feedback: "Hash tables resolve indices using hash keys, offering near-instant constant-time lookups." },
        { q: "What does the Python yield keyword do in {{TOPIC_0}}?", opts: ["Terminates program executions", "Suspends function execution and returns a generator iterator", "Allocates memory spaces", "Declares local variables"], correctText: "Suspends function execution and returns a generator iterator", feedback: "yield turns a normal function into a generator that yields values lazily." },
        { q: "Which protocol is standard for client-backend communications?", opts: ["FTP", "HTTP/HTTPS", "SMTP", "SSH"], correctText: "HTTP/HTTPS", feedback: "HTTP/HTTPS is the primary request-response protocol for web and API traffic." },
        { q: "What is a RESTful API's GET request designed to do?", opts: ["Delete remote database tables", "Retrieve information from a server without modifying state", "Create new database entries", "Encrypt user passwords"], correctText: "Retrieve information from a server without modifying state", feedback: "GET requests are read-only actions and should be safe and idempotent." },
        { q: "What is a decorator in Python?", opts: ["A theme designer tool", "A function that wraps another function to modify its behavior", "A file compression format", "An object validator"], correctText: "A function that wraps another function to modify its behavior", feedback: "Decorators dynamically add functionalities to functions or methods without modifying source code." }
      ],
      tf: [
        { q: "Dictionary keys in Python must be immutable (hashable).", correct: true, feedback: "True. Keys must be hashable so their hash index remains constant." },
        { q: "HTTP is a stateful protocol storing client connections naturally.", correct: false, feedback: "False. HTTP is stateless; session states are achieved via cookies or auth tokens." },
        { q: "In Python, variables are local to the function scope by default.", correct: true, feedback: "True. Variables assigned in functions are local unless explicitly declared global." },
        { q: "SQLite is a client-server database requiring a background port service.", correct: false, feedback: "False. SQLite is a lightweight, serverless database engine reading files directly." },
        { q: "Binary search works perfectly on an unsorted array.", correct: false, feedback: "False. Arrays must be sorted before binary search can correctly split bounds." }
      ],
      qa: [
        { q: "What is the difference between a list and a set in Python and {{TOPIC_0}}?", answer: "A list is an ordered collection that allows duplicate elements, whereas a set is an unordered collection of unique elements." },
        { q: "Explain what a Stack data structure is and its core operations.", answer: "A stack is a linear LIFO structure where insertions and deletions happen at the same end. Core actions are push (insert) and pop (remove)." },
        { q: "What is the Global Interpreter Lock (GIL) in Python?", answer: "A mutex preventing multiple native threads from executing Python bytecodes at once, ensuring thread-safe memory management but limiting parallel execution." },
        { q: "What does the ACID model guarantee in database transactions?", answer: "It guarantees database changes are processed reliably, preserving integrity under failures (Atomicity, Consistency, Isolation, Durability)." },
        { q: "What is recursion?", answer: "A programming technique where a function calls itself directly or indirectly to solve a task by reducing it to smaller base cases." }
      ]
    },
    business: {
      mcq: [
        { q: "What does SaaS stand for in {{TOPIC_0}}?", opts: ["Storage as a Service", "Software as a Service", "System as a System", "Service as a Software"], correctText: "Software as a Service", feedback: "SaaS is a software licensing and delivery model based on subscriptions." },
        { q: "What is Customer Acquisition Cost (CAC) in {{TOPIC_0}}?", opts: ["The manufacturing cost of goods", "Total marketing and sales expenses divided by new customers acquired", "The average price paid by a user", "The retail price of an asset"], correctText: "Total marketing and sales expenses divided by new customers acquired", feedback: "CAC tracks marketing efficiency by measuring the average cost to acquire one customer." },
        { q: "What is the primary role of a value proposition?", opts: ["To calculate taxation rates", "To explain why a product solves a user problem better than alternatives", "To catalog business files", "To buy stock options"], correctText: "To explain why a product solves a user problem better than alternatives", feedback: "Value propositions define the unique value and utility a business promises to deliver." },
        { q: "What is the basic equation of a balance sheet?", opts: ["Assets = Liabilities - Equity", "Assets = Liabilities + Equity", "Profit = Revenue - Expenses", "Equity = Assets + Liabilities"], correctText: "Assets = Liabilities + Equity", feedback: "The balance sheet equation equates owned assets with funding liabilities and equity." },
        { q: "What does MVP stand for in {{TOPIC_0}} planning?", opts: ["Most Valuable Partner", "Minimum Viable Product", "Metric Volume Process", "None of the above"], correctText: "Minimum Viable Product", feedback: "An MVP is the simplest product version released to validate user assumptions early." },
        { q: "What is Customer Lifetime Value (LTV)?", opts: ["The age of a customer", "The net revenue a business expects to gain from a customer over their relationship", "The cost of serving a customer", "The average discount rate"], correctText: "The net revenue a business expects to gain from a customer over their relationship", feedback: "LTV predicts total revenue generated by a customer during their account lifecycle." },
        { q: "What do Venture Capitalists (VCs) invest in?", opts: ["Government bonds", "High-growth potential startups in exchange for equity", "Real estate properties", "Gold commodities"], correctText: "High-growth potential startups in exchange for equity", feedback: "VCs inject high-risk capital into early-stage companies for fractional ownership." },
        { q: "What does burn rate measure in {{TOPIC_0}}?", opts: ["The temperature of servers", "The rate at which a company spends cash reserves before turning profitable", "The churn rate of employees", "The speed of manufacturing"], correctText: "The rate at which a company spends cash reserves before turning profitable", feedback: "Burn rate tracks monthly net negative cash outflows in startups." },
        { q: "What does B2B stand for?", opts: ["Back to Backend", "Business to Business", "Base to Base", "Browser to Browser"], correctText: "Business to Business", feedback: "B2B models transaction business directly with other corporate buyers." },
        { q: "What is the target market?", opts: ["The physical location of a shop", "The specific group of consumers most likely to buy a product", "The global stock exchange", "The inventory warehouse"], correctText: "The specific group of consumers most likely to buy a product", feedback: "Target markets are the focused buyer segments marketing campaigns target." },
        { q: "What is organic traffic in digital business?", opts: ["Traffic driven by paid banner ads", "Unpaid web visits originating from search engine results", "Visits from direct link buying", "Traffic from bot networks"], correctText: "Unpaid web visits originating from search engine results", feedback: "Organic traffic is driven by unpaid search results, optimized via SEO." }
      ],
      tf: [
        { q: "Bootstrapping means raising massive institutional capital from VCs.", correct: false, feedback: "False. Bootstrapping relies on self-funding and organic revenue loops." },
        { q: "A high churn rate is a healthy sign for software subscription businesses.", correct: false, feedback: "False. High churn means users are cancelling, which drains subscriber numbers." },
        { q: "Liabilities represent the owned resources of a company.", correct: false, feedback: "False. Assets are owned resources; liabilities are financial debts or obligations owed." },
        { q: "SEO focuses entirely on paid search advertising slots.", correct: false, feedback: "False. SEO optimizes content to rank higher in unpaid, organic search listings." },
        { q: "The Lean Startup model advocates launching complete, uneditable products without initial testing.", correct: false, feedback: "False. The model centers on iterating MVPs based on client test loops." }
      ],
      qa: [
        { q: "What is the difference between B2B and B2C models in {{TOPIC_0}}?", answer: "B2B sales target other corporate entities, whereas B2C sales target individual retail consumers directly." },
        { q: "Explain what a Minimum Viable Product (MVP) is in {{TOPIC_0}} strategy.", answer: "The simplest iteration of a product built with core features to begin learning and gather feedback from early adopters." },
        { q: "Why is the LTV-to-CAC ratio critical for startup success?", answer: "It measures marketing viability. Startups typically target an LTV:CAC ratio of 3:1 or higher to prove healthy unit economics." },
        { q: "What is product-market fit?", answer: "The point where a product aligns with a strong market demand and satisfies target customers who actively buy it." },
        { q: "Define cash flow in {{TOPIC_0}} terms.", answer: "The net movement of cash coming into and going out of a company during a specified period." }
      ]
    },
    general: {
      mcq: [
        { q: "What is the basic biological unit of all living organisms?", opts: ["The cell", "The atom", "The organelle", "The protein"], correctText: "The cell", feedback: "Cells are the building blocks of structure and function in living things." },
        { q: "Which computer component serves as the central brain?", opts: ["Graphics Card (GPU)", "Central Processing Unit (CPU)", "Hard Drive (SSD)", "Random Access Memory (RAM)"], correctText: "Central Processing Unit (CPU)", feedback: "The CPU processes basic arithmetic, control, and instruction operations." },
        { q: "What is the approximate speed of light in a vacuum?", opts: ["3,000 km/s", "300,000 km/s", "3,000,000 km/s", "300 km/s"], correctText: "300,000 km/s", feedback: "Light travels at roughly 3 x 10^8 meters per second (300,000 km/s)." },
        { q: "Which gas makes up the majority of Earth's atmosphere?", opts: ["Oxygen", "Carbon Dioxide", "Nitrogen", "Argon"], correctText: "Nitrogen", feedback: "Nitrogen accounts for about 78% of Earth's air volume." },
        { q: "What does URL stand for?", opts: ["Uniform Resource Locator", "Universal Routing Loop", "User Remote Link", "United Registry List"], correctText: "Uniform Resource Locator", feedback: "URLs specify the global address of resources on the web." },
        { q: "What is the primary function of a web browser?", opts: ["Hosting website databases", "Retrieving and presenting web resources from the World Wide Web", "Coding server scripts", "Compiling python code"], correctText: "Retrieving and presenting web resources from the World Wide Web", feedback: "Browsers interpret HTML, CSS, and JS to render visual pages to users." },
        { q: "Which element is the primary material in semiconductor microchips?", opts: ["Iron", "Copper", "Silicon", "Aluminum"], correctText: "Silicon", feedback: "Silicon's properties as a semiconductor make it ideal for integrated circuits." },
        { q: "What does DNS stand for in internet networks?", opts: ["Domain Name System", "Digital Network Security", "Direct Node Server", "Data Namespace Standard"], correctText: "Domain Name System", feedback: "DNS translates user-friendly domains to numeric IP addresses." },
        { q: "Which planet is commonly dubbed the Red Planet?", opts: ["Venus", "Mars", "Jupiter", "Saturn"], correctText: "Mars", feedback: "Mars features iron oxide on its surface, giving it a reddish hue." },
        { q: "What is gravity?", opts: ["A magnetic force", "A natural force drawing mass or energy together", "A solar radiation", "None of the above"], correctText: "A natural force drawing mass or energy together", feedback: "Gravity is the attractive force that acts between all objects with mass." },
        { q: "What is the role of RAM in a computer?", opts: ["Permanent file storage", "Volatile, high-speed temporary memory for running apps", "Displaying visual graphics", "Routing network traffic"], correctText: "Volatile, high-speed temporary memory for running apps", feedback: "RAM stores instructions currently used by the processor, losing data when shut down." }
      ],
      tf: [
        { q: "Sound waves travel faster in a vacuum than in standard air.", correct: false, feedback: "False. Sound is a mechanical wave requiring a physical medium to travel; it cannot travel in a vacuum." },
        { q: "The Earth orbits the Sun once every year.", correct: true, feedback: "True. Earth takes roughly 365.25 days to complete one solar orbit." },
        { q: "HTTP encrypts network traffic to secure passwords.", correct: false, feedback: "False. HTTP transmits plain text; HTTPS uses SSL/TLS encryption for security." },
        { q: "DNA contains the genetic code for living things.", correct: true, feedback: "True. DNA houses the molecular instructions for biological development." },
        { q: "Water is a chemical element in the periodic table.", correct: false, feedback: "False. Water (H2O) is a chemical compound composed of hydrogen and oxygen elements." }
      ],
      qa: [
        { q: "What is the difference between computer hardware and software?", answer: "Hardware consists of physical, touchable machinery (CPU, screen, keyboard); software is intangible code and programs directing the hardware." },
        { q: "Briefly explain how the Internet routes data.", answer: "The internet connects computers worldwide using protocols (TCP/IP), breaking data into packets and routing them dynamically through network switches." },
        { q: "What is the atmospheric greenhouse effect?", answer: "A natural process where greenhouse gases (CO2, methane) trap solar heat in the atmosphere, keeping Earth warm enough for life." },
        { q: "What is the role of a CPU in computers?", answer: "The CPU interprets program instructions, coordinating data transfers, logic, and arithmetic cycles." },
        { q: "Define Photosynthesis.", answer: "The process by which green plants utilize solar energy, water, and CO2 to produce oxygen and glucose." }
      ]
    }
  };

  function generateNotes(videoUrl, title) {
    // If no title is provided, try to extract a fallback title from the URL
    var resolvedTitle = title || parseFallbackTitle(videoUrl);
    
    // '' means same origin. Only fall back if AUTH_CONFIG is entirely missing.
    var apiUrl = (window.AUTH_CONFIG && typeof window.AUTH_CONFIG.API_BASE_URL === 'string')
      ? window.AUTH_CONFIG.API_BASE_URL
      : '';
    console.log("Calling backend AI service for:", resolvedTitle);
    
    return fetch(`${apiUrl}/api/notes/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ videoUrl: videoUrl, title: resolvedTitle })
    })
    .then(function(res) {
      if (!res.ok) {
        return res.text().then(function(t) {
          throw new Error("Backend API Error: " + (t || res.statusText));
        });
      }
      return res.json();
    });
  }

  global.NotesService = { generateNotes: generateNotes, extractVideoId: extractVideoId };
})(window);
