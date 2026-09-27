var SIM = SIM || {}

// Wowhead-style tooltips for content without a Wowhead page, such as Forever changes.
// Wowhead only exposes its custom tooltip API on wowhead.com, so this reproduces the
// look of its spell tooltips and anchors them the same way.
SIM.TOOLTIP = {

    target: null,

    init: function () {
        var view = this;
        $(document).on('mouseenter', '[data-tooltip]', function () { view.show(this); });
        $(document).on('mouseleave', '[data-tooltip]', function () { view.hide(); });
        // A rebuilt element never fires mouseleave, so hide once the pointer is elsewhere.
        $(document).on('mouseover', function (e) {
            if (view.target && !view.target.contains(e.target)) view.hide();
        });
    },

    // element is a jQuery object; content is {name, rank, cost, requires, description, next},
    // where cost is formatted like "15 Rage; Melee Range; Instant; 20 sec cooldown".
    set: function (element, content) {
        element.attr('data-tooltip', this.html(content)).attr('aria-label', this.text(content));
        if (this.target && element[0] === this.target) this.show(this.target);
    },

    html: function (content) {
        const esc = text => String(text).replace(/[&<>"]/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;'})[c]);
        const line = (left, right) => right ?
            `<div class="columns"><span>${esc(left || '')}</span><span>${esc(right)}</span></div>` : `<div>${esc(left)}</div>`;
        let html = `<div class="name">${esc(content.name)}</div>`;
        if (content.rank) html += line(content.rank);
        if (content.cost) {
            // Wowhead lays spell costs out as cost | range, then cast time | cooldown.
            const parts = content.cost.split(';').map(part => part.trim());
            const take = pattern => {
                const index = parts.findIndex(part => pattern.test(part));
                return index < 0 ? '' : parts.splice(index, 1)[0];
            };
            const power = take(/Rage$/), range = take(/Range$/), cooldown = take(/cooldown$/);
            if (power || range) html += line(power, range);
            if (parts.length || cooldown) html += line(parts.join(', '), cooldown);
        }
        if (content.requires) html += line(content.requires);
        if (content.description) html += `<div class="q">${esc(content.description)}</div>`;
        if (content.next) html += `<div class="next">Next rank:</div><div class="q">${esc(content.next)}</div>`;
        return html;
    },

    text: function (content) {
        return [content.name, content.rank, content.cost, content.requires, content.description,
            content.next && 'Next rank: ' + content.next].filter(Boolean).join('\n');
    },

    show: function (target) {
        const view = this;
        if (!view.element) {
            view.element = $('<div class="sim-tooltip"><div class="sim-tooltip-icon"><div></div></div><div class="sim-tooltip-body"></div></div>')
                .appendTo('body');
        }
        view.target = target;
        const images = $(target).find('img').toArray().map(img => `<img src="${img.getAttribute('src').trim()}" alt="">`);
        view.element.find('.sim-tooltip-icon').toggle(images.length > 0)
            .children().toggleClass('split', $(target).hasClass('split')).html(images.join(''));
        view.element.find('.sim-tooltip-body').html(target.getAttribute('data-tooltip'));
        view.element.css({left: 0, top: 0}).show();

        // Like Wowhead: above the target's top-right corner, below it when there is no room above.
        const rect = target.getBoundingClientRect();
        const width = view.element.outerWidth(true), height = view.element.outerHeight(true);
        const viewport = document.documentElement;
        let left = rect.right, top = rect.top - height;
        if (left + width > viewport.clientWidth) left = Math.max(0, rect.left - width);
        if (top < 0) top = Math.min(rect.bottom, Math.max(0, viewport.clientHeight - height));
        view.element.css({left: left + window.scrollX, top: top + window.scrollY});
    },

    hide: function () {
        this.target = null;
        if (this.element) this.element.hide();
    },
};
