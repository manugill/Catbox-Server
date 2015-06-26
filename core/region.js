// Region object
/* x = longitude, y = latitude */
function Region(points) {
	this.points = points || [];
}

Region.prototype.length = function() {
	return this.points.length;
}

Region.prototype.area = function() {
	var area = 0;
	var i, j, p1, p2;
	var len = this.length();

	for (i = 0, j = len-1; i < len; j = i, i++) {
		p1 = this.points[i];
		p2 = this.points[j];
		area += p1[0] * p2[1];
		area -= p1[1] * p2[0];
	}
	area /= 2;

	return area;
};

Region.prototype.centroid = function() {
	var x = 0;
	var y = 0;
	var i, j, f, p1, p2;
	var len = this.length();

	for (i = 0, j = len-1; i < len; j = i, i++) {
		p1 = this.points[i];
		p2 = this.points[j];
		f = p1[0]*p2[1] - p2[0]*p1[1];
		x += (p1[0] + p2[0])*f;
		y += (p1[1] + p2[1])*f;
	}

	f = this.area() * 6;

	return [ x/f, y/f ];
};

module.exports = Region;