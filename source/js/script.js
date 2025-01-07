if (typeof hasExecuted==='undefined') {
    hasExecuted=true;
    function hashScrollIntoView() {
        console.log(2);
        try {
            let element = document.querySelector(decodeURI(location.hash));
            element.scrollIntoView({ behavior: "smooth", block: "center", inline: "nearest" });
        } catch (error) { }
    }
    window.addEventListener('load', hashScrollIntoView);
    window.addEventListener('hashchange', hashScrollIntoView);
    console.log(1);
}