# Standard Lua Libraries
<secondary-label ref="function"/>
<secondary-label ref="process"/>
<secondary-label ref="workflow"/>

Core Lua libraries automatically available in all Wippy processes. No `require()` needed.

## Global Functions

### Type and Conversion

```lua
type(value)         -- Returns: "nil", "number", "string", "boolean", "table", "function", "thread", "userdata"
tonumber(s [,base]) -- Convert to number, optional base (2-36)
tostring(value)     -- Convert to string, calls __tostring metamethod
```

### Assertions and Errors

```lua
assert(v [,msg])    -- Raises error if v is false/nil, returns v otherwise
error(msg [,level]) -- Raises error at specified stack level (default 1)
pcall(fn, ...)      -- Protected call, returns ok, result_or_error
xpcall(fn, errh)    -- Protected call with error handler function
```

### Table Iteration

```lua
pairs(t)            -- Iterate all key-value pairs
ipairs(t)           -- Iterate array portion (1, 2, 3, ...)
next(t [,index])    -- Get next key-value pair after index
```

### Metatables

```lua
getmetatable(obj)       -- Get metatable (or __metatable field if protected)
setmetatable(t, mt)     -- Set metatable, returns t
```

### Raw Table Access

Bypass metamethods for direct table access:

```lua
rawget(t, k)        -- Get t[k] without __index
rawset(t, k, v)     -- Set t[k]=v without __newindex
rawequal(a, b)      -- Compare without __eq
```

### Utilities

```lua
select(index, ...)  -- Return args from index onwards
select("#", ...)    -- Return number of args
unpack(t [,i [,j]]) -- Return t[i] through t[j] as multiple values
print(...)          -- Print values (uses structured logging in Wippy)
```

### Global Variables

```lua
_G        -- The global environment table
_VERSION  -- Lua version string
```

## Table Manipulation

Functions for modifying tables:

```lua
table.insert(t, [pos,] value)  -- Insert value at pos (default: end)
table.remove(t [,pos])         -- Remove and return element at pos (default: last)
table.concat(t [,sep [,i [,j]]]) -- Concatenate array elements with separator
table.sort(t [,comp])          -- Sort in place, comp(a,b) returns true if a < b
table.pack(...)                -- Pack varargs into table with 'n' field
table.unpack(t [,i [,j]])      -- Unpack table elements as multiple values
```

```lua
local items = {"a", "b", "c"}

table.insert(items, "d")           -- {"a", "b", "c", "d"}
table.insert(items, 2, "x")        -- {"a", "x", "b", "c", "d"}
table.remove(items, 2)             -- {"a", "b", "c", "d"}, returns "x"

local csv = table.concat(items, ",")  -- "a,b,c,d"

table.sort(items, function(a, b)
    return a > b  -- Descending order
end)
```

## String Operations

String manipulation functions. Also available as methods on string values:

### Pattern Matching

```lua
string.find(s, pattern [,init [,plain]])   -- Find pattern, returns start, end, captures
string.match(s, pattern [,init])           -- Extract matching substring
string.gmatch(s, pattern)                  -- Iterator over all matches
string.gsub(s, pattern, repl [,n])         -- Replace matches, returns string, count
```

### Case Conversion

```lua
string.upper(s)   -- Convert to uppercase
string.lower(s)   -- Convert to lowercase
```

### Substrings and Characters

```lua
string.sub(s, i [,j])      -- Substring from i to j (negative indexes from end)
string.len(s)              -- String length (or use #s)
string.byte(s [,i [,j]])   -- Numeric codes of characters
string.char(...)           -- Create string from character codes
string.rep(s, n [,sep])    -- Repeat string n times with separator
string.reverse(s)          -- Reverse string
```

### Formatting

```lua
string.format(fmt, ...)    -- Printf-style formatting
```

Format specifiers: `%d` (integer), `%f` (float), `%s` (string), `%q` (quoted), `%x` (hex), `%o` (octal), `%e` (scientific), `%%` (literal %)

```lua
local s = "Hello, World!"

-- Pattern matching
local start, stop = string.find(s, "World")  -- 8, 12
local word = string.match(s, "%w+")          -- "Hello"

-- Substitution
local new = string.gsub(s, "World", "Wippy") -- "Hello, Wippy!"

-- Method syntax
local upper = s:upper()                       -- "HELLO, WORLD!"
local part = s:sub(1, 5)                      -- "Hello"
```

### Patterns

| Pattern | Matches |
|---------|---------|
| `.` | Any character |
| `%a` | Letters |
| `%d` | Digits |
| `%w` | Alphanumeric |
| `%s` | Whitespace |
| `%p` | Punctuation |
| `%c` | Control characters |
| `%x` | Hexadecimal digits |
| `%z` | Zero (null) |
| `[set]` | Character class |
| `[^set]` | Negated class |
| `*` | 0 or more (greedy) |
| `+` | 1 or more (greedy) |
| `-` | 0 or more (lazy) |
| `?` | 0 or 1 |
| `^` | Start of string |
| `$` | End of string |
| `%b()` | Balanced pair |
| `(...)` | Capture group |

Uppercase versions (`%A`, `%D`, etc.) match the complement.

## Math Functions

Mathematical functions and constants:

### Constants {id="math-constants"}

```lua
math.pi       -- 3.14159...
math.huge     -- Infinity
math.mininteger  -- Minimum integer
math.maxinteger  -- Maximum integer
```

### Basic Operations

```lua
math.abs(x)           -- Absolute value
math.min(...)         -- Minimum of arguments
math.max(...)         -- Maximum of arguments
math.floor(x)         -- Round down
math.ceil(x)          -- Round up
math.modf(x)          -- Integer and fractional parts
math.fmod(x, y)       -- Floating-point remainder
```

### Powers and Roots

```lua
math.sqrt(x)          -- Square root
math.pow(x, y)        -- x^y (or use x^y operator)
math.exp(x)           -- e^x
math.log(x [,base])   -- Natural log (or log base n)
```

### Trigonometry

```lua
math.sin(x)   math.cos(x)   math.tan(x)    -- Radians
math.asin(x)  math.acos(x)  math.atan(y [,x])
math.sinh(x)  math.cosh(x)  math.tanh(x)   -- Hyperbolic
math.deg(r)   -- Radians to degrees
math.rad(d)   -- Degrees to radians
```

### Random Numbers

```lua
math.random()         -- Random float [0,1)
math.random(n)        -- Random integer [1,n]
math.random(m, n)     -- Random integer [m,n]
math.randomseed(x)    -- Set random seed
```

### Type Conversion

```lua
math.tointeger(x)     -- Convert to integer or nil
math.type(x)          -- "integer", "float", or nil
math.ult(m, n)        -- Unsigned less-than comparison
```

## Coroutines

Coroutine creation and control. See [Channels and Coroutines](lua/core/channel.md) for channels and concurrent patterns:

```lua
coroutine.create(fn)        -- Create coroutine from function
coroutine.resume(co, ...)   -- Start/continue coroutine
coroutine.yield(...)        -- Suspend coroutine, return values to resume
coroutine.status(co)        -- "running", "suspended", "normal", "dead"
coroutine.running()         -- Current coroutine (nil if main thread)
coroutine.wrap(fn)          -- Create coroutine as callable function
```

### Spawning Concurrent Coroutines

Spawn a concurrent coroutine that runs independently (Wippy-specific):

```lua
coroutine.spawn(fn)         -- Spawn function as concurrent coroutine
```

```lua
-- Spawn background task
coroutine.spawn(function()
    while true do
        check_health()
        time.sleep("30s")
    end
end)

-- Continue main execution immediately
process_request()
```

## Error Handling

Structured error creation and classification. See [Error Handling](lua/core/errors.md) for full documentation:

### Constants {id="error-constants"}

```lua
errors.UNKNOWN           -- Unclassified error
errors.INVALID           -- Invalid argument or input
errors.NOT_FOUND         -- Resource not found
errors.ALREADY_EXISTS    -- Resource already exists
errors.PERMISSION_DENIED -- Permission denied
errors.TIMEOUT           -- Operation timed out
errors.CANCELED          -- Operation cancelled
errors.UNAVAILABLE       -- Service unavailable
errors.INTERNAL          -- Internal error
errors.CONFLICT          -- Conflict (e.g., concurrent modification)
errors.RATE_LIMITED      -- Rate limit exceeded
```

### Functions {id="error-functions"}

```lua
-- Create error from string
local err = errors.new("something went wrong")

-- Create error with metadata
local err = errors.new({
    message = "User not found",
    kind = errors.NOT_FOUND,
    retryable = false,
    details = {user_id = 123}
})

-- Wrap existing error with context
local wrapped = errors.wrap(err, "failed to load profile")

-- Check error kind
if errors.is(err, errors.NOT_FOUND) then
    -- handle not found
end

-- Get call stack from error
local stack = errors.call_stack(err)
```

### Error Methods

```lua
err:message()    -- Get error message string
err:kind()       -- Get error kind (e.g., "NOT_FOUND")
err:retryable()  -- true, false, or nil (unknown)
err:details()    -- Get details table or nil
err:stack()      -- Get stack trace as string
```

## UTF-8 Unicode

Unicode UTF-8 string handling:

### Constants {id="utf8-constants"}

```lua
utf8.charpattern  -- Pattern matching a single UTF-8 character
```

### Functions {id="utf8-functions"}

```lua
utf8.char(...)           -- Create string from Unicode codepoints
utf8.codes(s)            -- Iterator over codepoints: for pos, code in utf8.codes(s)
utf8.codepoint(s [,i [,j]]) -- Get codepoints at positions i to j
utf8.len(s [,i [,j]])    -- Count UTF-8 characters (not bytes)
utf8.offset(s, n [,i])   -- Byte position of n-th character from position i
```

```lua
local s = "Hello, 世界"

-- Count characters (not bytes)
print(utf8.len(s))  -- 9

-- Iterate over codepoints
for pos, code in utf8.codes(s) do
    print(pos, code, utf8.char(code))
end

-- Get codepoint at position
local code = utf8.codepoint(s, 8)  -- First Chinese character

-- Create string from codepoints
local emoji = utf8.char(0x1F600)  -- Grinning face
```

## Restricted Features

The following standard Lua features are NOT available for security:

| Feature | Alternative |
|---------|-------------|
| `load`, `loadstring`, `loadfile`, `dofile` | Use [Dynamic Evaluation](lua/dynamic/eval.md) module |
| `collectgarbage` | Automatic GC |
| `rawlen` | Use `#` operator |
| `io.*` | Use [File System](lua/storage/filesystem.md) module |
| `os.execute`, `os.exit`, `os.remove`, `os.rename`, `os.tmpname` | Use [Command Execution](lua/dynamic/exec.md), [Environment](lua/system/env.md) modules |
| `debug.*` (except traceback) | Not available |
| `package.loadlib` | Native libraries not supported |

## See Also

- [Channels and Coroutines](lua/core/channel.md) - Go-style channels for concurrency
- [Error Handling](lua/core/errors.md) - Creating and handling structured errors
- [OS Time](lua/system/ostime.md) - System time functions
