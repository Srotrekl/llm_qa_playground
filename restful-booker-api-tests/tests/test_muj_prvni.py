def test_health_check(booking_service):
    response = booking_service.ping()     
    assert response.status_code == 201  


def test_auth_valid_credentials(booking_service):
    response = booking_service.authenticate("admin", "password123")
    assert response.status_code == 200
    assert "token" in response.json()   

def test_auth_wrong_password(booking_service):
    response = booking_service.authenticate("admin", "spatneheslo")
    assert response.status_code == 200
    assert response.json()["reason"] == "Bad credentials"

def test_get_booking_returns_list(booking_service):
    response = booking_service.get_bookings()
    assert response.status_code == 200
    assert len(response.json()) > 0

def test_create_booking(booking_service):
    response = booking_service.create_booking_raw({
        "firstname": "Steve",
        "lastname": "Test",
        "totalprice": 150,
        "depositpaid": True,
        "bookingdates": {
            "checkin": "2026-07-01",
            "checkout": "2026-07-05"
        }
    })
    assert response.status_code == 200
    assert response.json()["booking"]["firstname"] == "Steve"
