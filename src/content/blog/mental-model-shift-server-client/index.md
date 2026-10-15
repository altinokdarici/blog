---
title: "The Mental Model Shift: From Server to Client and Back Again"
description: "How the web industry evolved from server-side templates to SPAs to hybrid architectures, and why each transition required developers to think differently."
date: "2025-04-19"
tags: ["architecture", "react", "javascript"]
---

If you learned web development in the early 2000s, you thought in pages. A user clicked a link. The browser sent a request. The server ran some code, merged data with a template, and sent back HTML. Every interaction was a full page reload.

If you learned web development in the 2010s, you thought in state. The browser loaded a JavaScript bundle. That bundle managed everything. The server was just an API. Navigation happened client-side. The page never reloaded.

If you are learning web development today, you have to think in boundaries. Some components run on the server. Some run on the client. Some run in both places at different times. The framework manages what crosses the network.

This is not just a difference in tools. It is a difference in how you model the entire system.

## The server-side mental model

In the PHP, Rails, or ASP.NET era, the mental model was straightforward. You wrote server-side code that rendered HTML. When a user clicked something, the server processed the request and sent back a new page.

```php
// user.php
<?php
$user = getUser($_GET['id']);
?>
<html>
  <body>
    <h1><?= $user->name ?></h1>
    <p><?= $user->bio ?></p>
  </body>
</html>
```

The model was:
- **Every interaction is a request/response cycle**
- **State lives in the database and session**
- **The server owns the rendering logic**
- **JavaScript is for light enhancements**

This worked well for content-heavy sites. It was simple to reason about. But interactions felt slow. Every click triggered a full page reload. Building rich, interactive experiences required fighting against the model.

## Why we moved to the client

In 2010, Gmail and Google Maps showed what was possible when you moved logic to the client. Instead of reloading the entire page for every action, you could update just the parts that changed. Applications felt faster and more responsive.

By 2013, frameworks like Angular, Ember, and Backbone standardized this pattern. By 2015, React became the dominant way to build client-side applications.

The new mental model was:
- **Everything runs in the browser**
- **The server is just a JSON API**
- **State lives in JavaScript**
- **Routing and rendering happen client-side**

Your React component did not care about servers or requests. It just described UI as a function of state. When state changed, React updated the DOM.

```jsx
function UserProfile({ userId }) {
  const [user, setUser] = useState(null);

  useEffect(() => {
    fetch(`/api/users/${userId}`)
      .then(res => res.json())
      .then(setUser);
  }, [userId]);

  if (!user) return <div>Loading...</div>;

  return (
    <div>
      <h1>{user.name}</h1>
      <p>{user.bio}</p>
    </div>
  );
}
```

This was powerful. You could build complex, interactive UIs without wrestling with page reloads. The entire application lived in one place: the client.

For a few years, this felt like the right model.

## What broke with SPAs

The problems showed up gradually.

**Bundle sizes grew.** Moving everything to the client meant sending all your code upfront. A todo app might be fine. But a real application with routing, state management, forms, charts, and authentication could easily hit hundreds of kilobytes of JavaScript. Users on slow networks waited seconds before seeing anything.

**Time-to-interactive got worse.** Even after the HTML loaded, the page was not usable until JavaScript downloaded, parsed, and executed. On mobile devices, this could take multiple seconds. Server-side rendering helped with the initial paint, but hydration still blocked interactivity.

**Data fetching became awkward.** In the old server model, you fetched data and rendered HTML in one step. In SPAs, you had to fetch data client-side after the bundle loaded. This added waterfalls. The page would load, then fetch data, then render. Every layer of nesting made it worse.

**SEO and social sharing required workarounds.** Search engines and social media crawlers expected HTML, not JavaScript bundles. Teams added server-side rendering or pre-rendering pipelines to work around this. But now you were running React in two places with different constraints.

The SPA model solved interaction problems but created performance and complexity problems.

## The return to the server (but differently)

Around 2020, the industry started moving logic back to the server. But not in the old way. We were not going back to PHP templates.

Next.js introduced patterns like `getServerSideProps` and `getStaticProps`. Remix leaned into server-side data loading with nested routes. React introduced Server Components as a primitive for running components on the server.

The new model is hybrid. Some code runs on the server. Some runs on the client. The framework manages the boundary.

```jsx
// This component runs on the server
async function UserProfile({ userId }) {
  const user = await db.users.findById(userId);

  return (
    <div>
      <h1>{user.name}</h1>
      <p>{user.bio}</p>
      <LikeButton userId={userId} />
    </div>
  );
}

// This component runs on the client
'use client';
function LikeButton({ userId }) {
  const [liked, setLiked] = useState(false);

  return (
    <button onClick={() => setLiked(!liked)}>
      {liked ? 'Unlike' : 'Like'}
    </button>
  );
}
```

The mental model is now:
- **Components can run on the server or client**
- **Data fetching happens server-side by default**
- **Interactive pieces are explicitly marked**
- **The framework manages serialization and hydration**

This is more efficient. The server can fetch data close to the database, render non-interactive UI, and send only the minimal JavaScript needed for interactivity. But it is also more complex to reason about.

## The new mental model is harder

The hardest part of modern React is not the syntax. It is knowing where your code runs.

In the SPA era, everything ran in one place. You never thought about serialization, network boundaries, or when components executed. It all happened in the browser.

Now you have to ask:
- **Is this a server component or a client component?**
- **Can I use hooks here?**
- **When does this code execute?**
- **Can I pass this prop across the boundary?**
- **What gets serialized and sent to the client?**

You cannot just "use state" anymore. You have to understand that `useState` only works in client components. You cannot just import a component. You have to know whether it is designed for the server or the client.

The framework tries to help. Next.js, Remix, and others provide conventions. But the mental model is inherently more complex because the system is distributed. Your UI now spans two environments.

## Why this complexity is worth it

The reason we are moving to this model is not just performance. It is about making the right trade-offs by default.

SPAs made everything interactive but shipped too much JavaScript. Server-only rendering made everything fast but killed interactivity. The hybrid model lets you choose per component.

Most UI does not need interactivity. A blog post. A user profile. A list of products. These can all render on the server, send plain HTML, and load instantly.

But some pieces do need interactivity. A like button. A comment form. A shopping cart. These can be client components with state.

The framework sends just enough JavaScript to make the interactive parts work. The rest is static HTML. This is the best of both worlds, but it requires you to think about boundaries.

## What this means for developers

If you learned React as a client-side framework, this shift is disorienting. React is no longer just "a library for building UIs in the browser." It is a model for describing UIs that can run anywhere.

The good news is that the primitives are stabilizing. Server Components, streaming SSR, and resumability are becoming standard patterns. The frameworks are getting better at hiding the complexity.

But the mental model shift is real. You have to unlearn the assumption that all your code runs in one place. You have to think about where data flows, what crosses the network, and what runs when.

The web is moving toward a model where the server and client are not separate systems. They are two parts of the same application. The framework manages the boundary, but you still need to understand that the boundary exists.

This is the cost of the evolution. We are building more efficient and scalable systems. But they require more sophisticated mental models. The tools are getting better. The question is whether developers can adapt to a world where components exist in multiple contexts at once.
