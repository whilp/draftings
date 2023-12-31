/** 
 * Parent is the base for things that have children.
 */
class Parent {
  constructor() {
    this.children = [];
  }

  /**
     * push adds a child; chainable.
     * 
     * @param {Object} child - The child element to add
     * @returns {Object} The child element that was added
     */
  push(child) {
    this.children.push(child);
    return child;
  }
}

/**
   * Draft is how you build contents in a document.
   */
class Draft extends Parent {

  /** 
   * apply calls `apply` (if present/defined) on each of the draft's children, 
   * passing `body`. Calls `finish` /after/ running all of the children's methods 
   * to clean up.
   * 
   * @param {Object} body - The object which applies the function
   */
  apply(body) {
    this.children.forEach(c => {
      if (typeof c.apply === 'function') {
        c.apply(body);
      }
    });
    this.finish();
  }

  finish() {
    // Workaround for elements that only work when set (again) at the end.
    this.children.forEach(c => {
      if (typeof c.finish === 'function') {
        c.finish(this.body);
      }
    });
  }

  Paragraph() {
    return this.push(new Paragraph(this));
  }

  ListItem() {
    return this.push(new ListItem(this));
  }

  // TODO: Table.
}

class Element extends Parent {
  constructor(parent, insert) {
    super()
    this.parent = parent;
    this.style = {}
    this.insert = insert;
    this.element = undefined;
    this.SpacingBefore(10);
  }

  apply(body) {
    const text = this.children.map(c => c.text).join('');
    this.element = body[this.insert](body.getNumChildren() - 1, text);
    this.element.setAttributes(this.style);

    let start = 0;
    this.children.forEach(child => {
      const end = start + child.text.length;
      child.apply(this.element, start, end);
      start = end;
    });
  }

  SpacingBefore(spacing) {
    this.style[DocumentApp.Attribute.SPACING_BEFORE] = spacing;
    return this;
  }

  SpacingAfter(spacing) {
    this.style[DocumentApp.Attribute.SPACING_AFTER] = spacing;
    return this;
  }

  Text(text) {
    return this.push(new Text(this, text));
  }

  Rule() {
    return this.push(new Rule(this));
  }

  Image() {
    return this.push(new Image(this));
  }
}

class Paragraph extends Element {
  constructor(parent) {
    super(parent, 'insertParagraph')
  }
}

class ListItem extends Element {
  constructor(parent) {
    super(parent, 'insertListItem');
    this.level = 0;
    this.glyphs = [];
  }

  finish(body) {
    // Workaround; glyph type must be set again at the end for nested items.
    this.element.setAttributes(this.style)
  }

  Type(level, ...glyphs) {
    this.glyphs = glyphs;
    return this.Nest(this.level);
  }

  Bullet() {
    return this.Type(
      this.level,
      DocumentApp.GlyphType.BULLET,
      DocumentApp.GlyphType.HOLLOW_BULLET,
      DocumentApp.GlyphType.SQUARE_BULLET,
    )
  }

  Number() {
    return this.Type(
      this.level,
      DocumentApp.GlyphType.NUMBER,
      DocumentApp.GlyphType.LATIN_LOWER,
      DocumentApp.GlyphType.SQUARE_BULLET,
    )
  }

  Latin() {
    return this.Type(
      this.level,
      DocumentApp.GlyphType.LATIN_LOWER,
      DocumentApp.GlyphType.NUMBER,
      DocumentApp.GlyphType.SQUARE_BULLET,
    );
  }

  Glyph(glyph) {
    this.style[DocumentApp.Attribute.GLYPH_TYPE] = glyph;
    return this;
  }

  Nest(level) {
    this.level = level
    this.style[DocumentApp.Attribute.NESTING_LEVEL] = level;
    return this.Glyph(this.glyphs[level])
  }
}

class Rule {
  constructor(parent) {
    this.parent = parent;
    this.style = {};
    this.text = "";
  }

  apply(body, start, end) {
    body.appendHorizontalRule();
  }
}

class Image {
  constructor(parent) {
    this.parent = parent;
    this.style = {};
    this.text = "";
    this.blob = undefined;
  }

  get width() {
    return this.style[DocumentApp.Attribute.WIDTH];
  }

  get height() {
    return this.style[DocumentApp.Attribute.HEIGHT];
  }

  fromChart(chart) {
    const blob = chart.getBlob();
    const options = chart.getOptions();

    return this
      .Blob(blob)
      .Width(options.get("width"))
      .Height(options.get("height"))
  }

  Blob(blob) {
    this.blob = blob;
    return this;
  }

  Scale(scale = 1) {
    return this.Width(this.width * scale)
      .Height(this.height * scale);
  }

  Width(width) {
    this.style[DocumentApp.Attribute.WIDTH] = width;
    return this;
  }

  Height(height) {
    this.style[DocumentApp.Attribute.HEIGHT] = height;
    return this;
  }

  apply(body, start, end) {
    const image = body.appendInlineImage(this.blob);
    image.setAttributes(this.style);
  }
}

class Text {
  constructor(parent, text) {
    this.parent = parent;
    this.text = text;
    this.style = {};
  }

  apply(body, start, end) {
    const text = body.editAsText()
    text.setAttributes(start, Math.max(start, end - 1), this.style);
  }

  Text(text) {
    return this.parent.Text(text);
  }

  Strike() {
    this.style[DocumentApp.Attribute.STRIKETHROUGH] = true;
    return this;
  }

  Bold() {
    this.style[DocumentApp.Attribute.BOLD] = true;
    return this;
  }

  Italic() {
    this.style[DocumentApp.Attribute.ITALIC] = true;
    return this;
  }

  Mono() {
    this.style[DocumentApp.Attribute.FONT_FAMILY] = 'Roboto Mono';
    this.style[DocumentApp.Attribute.FOREGROUND_COLOR] = '#188038';
    return this;
  }

  Link(url) {
    this.style[DocumentApp.Attribute.LINK_URL] = url;
    this.style[DocumentApp.Attribute.FOREGROUND_COLOR] = '#1967d2';
    return this;
  }
}


class Chart {

  constructor() {
    this.x = undefined;
    this.y = undefined;
    this.title = undefined;
    this.height = 300;
    this.width = this.height * 1.618;
    this.margin = (1 / 10) * this.width;
    this.color = '#4285F4'
    this.inkColor = 'grey'
    this.format = 'short';
    this.thickness = 3;
  }

  X(label, data) {
    this.x = {
      data: data,
      label: label,
    }
    return this;
  }

  Y(label, data) {
    this.y = {
      data: data,
      label: label,
    }
    return this;
  }

  Format(format) {
    this.format = format;
    return this;
  }

  chart() {
    return Charts.newLineChart()
  }

  make() {
    const data = Charts.newDataTable()
      .addColumn(Charts.ColumnType.DATE, this.x.label)
      .addColumn(Charts.ColumnType.NUMBER, this.y.label)
    this.x.data.forEach((value, index) => data.addRow([value, this.y.data[index]]))

    return this.chart()
      .setDataTable(data.build())
      .setTitle(this.y.label)
      // TODO: doesn't work in appscript
      // .setOption('backgroundColor', 'transparent')
      .setOption('legend.position', 'none')
      .setOption('titleTextStyle', { color: this.inkColor, fontSize: 20 })
      .setOption('hAxis.textStyle', { color: this.inkColor, fontSize: 12 })
      .setOption('vAxis.textStyle', { color: this.inkColor, fontSize: 12 })
      .setOption('colors', [this.color])
      .setOption('hAxis.format', 'yyyy-MM-dd')
      .setOption('hAxis.gridlines', { color: 'transparent', count: 3 })
      .setOption('vAxis.gridlines', { color: this.inkColor, count: 4 })
      // TODO: doesn't work in appscript :/
      //.setOption('hAxis.baselineColor', this.inkColor)
      .setOption('vAxis.minorGridlines', { count: 0 })
      .setOption('vAxis.format', this.format)
      .setOption('lineWidth', this.thickness)
      .setOption('chartArea', {
        left: this.margin,
        top: this.margin,
        width: this.width - (2 * this.margin),
        height: this.height - (2 * this.margin)
      })
      .setDimensions(this.width, this.height)
  }

  build() {
    return this.make().build()
  }
}

class LineChart extends Chart {
  chart() {
    return Charts.newLineChart()
  }
}

class ColumnChart extends Chart {
  chart() {
    return Charts.newColumnChart()
  }
}
