const VERTICES = array<vec2f, 6>(
        vec2f(-1, -1),
        vec2f(-1, 1),
        vec2f(1, -1),
        vec2f(1, 1),
        vec2f(-1, 1),
        vec2f(1, -1),
    );

const UVS = array<vec2f, 6>(
        vec2f(0, 0),
        vec2f(0, 1),
        vec2f(1, 0),
        vec2f(1, 1),
        vec2f(0, 1),
        vec2f(1, 0),
    );

fn latLonToXY(lat: f32, lon: f32) -> vec2f {
    // Since our map area is kiiiiinda small, a linear mapping is okay
    return vec2f(
            (lon - u.mapLongitudeMin) / (u.mapLongitudeMax - u.mapLongitudeMin),
            (lat - u.mapLatitudeMin) / (u.mapLatitudeMax - u.mapLatitudeMin),
        );
}

fn u32ToHashColor(districtIndex: u32) -> vec3f {
    // This number changes the color scheme
    let magicNumber = 888888u;
    return unpack4x8unorm(((districtIndex % 127) + 1) * magicNumber).rgb;
}

// Your code here :)